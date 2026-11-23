import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import {
  getPoliciesOptions,
  getPoliciesQueryKey,
  putPoliciesMutation,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Checkbox } from "../../components/ui/Checkbox.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import styles from "./PoliciesCard.module.css";

const RETENTION_OPTIONS = [1, 3, 5, 7, 10, 15, 20, 30].map((years) => ({
  value: String(years),
  label: years === 1 ? "1 año" : `${years} años`,
}));

const SESSION_OPTIONS = [1, 3, 7, 14].map((days) => ({
  value: String(days),
  label: days === 1 ? "1 día" : `${days} días`,
}));

// Políticas del despacho: dos decisiones que afectan a todo el equipo. Las ve quien gestiona el
// despacho y solo el propietario las cambia. Cada cambio queda en la auditoría de seguridad.
export function PoliciesCard({ canEdit }: { canEdit: boolean }) {
  const policies = useQuery(getPoliciesOptions());

  return (
    <Panel title="Políticas del despacho">
      {policies.isPending && <p role="status">Cargando las políticas</p>}
      {(policies.isError || (policies.isSuccess && !policies.data)) && (
        <Notice tone="error">
          <p>No pudimos consultar las políticas del despacho.</p>
        </Notice>
      )}
      {policies.data && (
        <PoliciesForm
          // Si el servidor devuelve otros valores, el formulario se reinicia con ellos.
          key={`${policies.data.default_retention_years}-${policies.data.session_days}-${policies.data.require_two_factor}`}
          retention={policies.data.default_retention_years}
          session={policies.data.session_days}
          requireTwoFactor={policies.data.require_two_factor ?? false}
          canEdit={canEdit}
        />
      )}
    </Panel>
  );
}

function PoliciesForm({
  retention,
  session,
  requireTwoFactor,
  canEdit,
}: {
  retention: number;
  session: number;
  requireTwoFactor: boolean;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [years, setYears] = useState(String(retention));
  const [days, setDays] = useState(String(session));
  const [required, setRequired] = useState(requireTwoFactor);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    ...putPoliciesMutation(),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: getPoliciesQueryKey() });
    },
    onError: (failure) => {
      const { status, detail } = apiProblem(failure);
      setRequired(requireTwoFactor);
      setError(
        status === 409
          ? (detail ?? "No pudimos guardar las políticas.")
          : "No pudimos guardar las políticas.",
      );
    },
  });

  const unchanged =
    years === String(retention) &&
    days === String(session) &&
    required === requireTwoFactor;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setError(undefined);
    save.mutate({
      body: {
        default_retention_years: Number(years),
        session_days: Number(days),
        require_two_factor: required,
      },
    });
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Select
        label="Conservación de los casos archivados"
        value={years}
        onChange={(event) => setYears(event.target.value)}
        options={RETENTION_OPTIONS}
        disabled={!canEdit}
        help="Cuánto tiempo se guarda un caso después de archivarlo, antes de su revisión. Solo cuenta para los que se archiven desde ahora; los ya archivados conservan su plazo."
      />
      <Select
        label="Duración de la sesión"
        value={days}
        onChange={(event) => setDays(event.target.value)}
        options={SESSION_OPTIONS}
        disabled={!canEdit}
        help="Cuánto puede pasar antes de que le pidan ingresar de nuevo a cualquier persona del equipo. Solo cuenta para los ingresos nuevos."
      />
      <Checkbox
        checked={required}
        disabled={!canEdit}
        onChange={(event) => setRequired(event.target.checked)}
      >
        Exigir la verificación en dos pasos a todo el equipo
      </Checkbox>
      <p className={styles.hint}>
        Quien no la tenga podrá ingresar, pero solo llegará a activarla; hasta
        entonces nada más del espacio de trabajo le responde. Usted debe tenerla
        activa antes de exigirla, y mientras esté exigida nadie podrá
        desactivarla.
      </p>
      {!canEdit && (
        <Notice tone="info">
          <p>Solo la persona propietaria puede cambiar estas políticas.</p>
        </Notice>
      )}
      {error && (
        <Notice tone="error">
          <p role="alert">{error}</p>
        </Notice>
      )}
      {saved && <Notice tone="success">Guardamos las políticas.</Notice>}
      {canEdit && (
        <Button type="submit" busy={save.isPending} disabled={unchanged}>
          {save.isPending ? "Guardando" : "Guardar políticas"}
        </Button>
      )}
    </form>
  );
}
