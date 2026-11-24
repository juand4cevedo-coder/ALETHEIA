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

const SESSION_OPTIONS = [1, 3, 7, 14].map((days) => ({
  value: String(days),
  label: days === 1 ? "1 día" : `${days} días`,
}));

// Políticas del despacho: dos decisiones que afectan a todo el equipo. El plazo de conservación
// de los casos archivados es el mismo para todos los despachos y aquí solo se informa. Las ve quien gestiona el
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
          key={`${policies.data.session_days}-${policies.data.require_two_factor}`}
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

  const unchanged = days === String(session) && required === requireTwoFactor;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setError(undefined);
    save.mutate({
      body: {
        session_days: Number(days),
        require_two_factor: required,
      },
    });
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.fixed}>
        <p className={styles.fixedLabel}>
          Conservación de los casos archivados
        </p>
        <p className={styles.fixedValue}>
          {retention} años desde el cierre del caso
        </p>
        <p className={styles.hint}>
          Es el mismo plazo para todos los despachos y no se cambia desde la
          aplicación.
        </p>
      </div>
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
        Quien no la tenga solo podrá activarla al ingresar. Usted debe tenerla
        activa antes de exigirla.
      </p>
      {!canEdit && (
        <p className={styles.hint}>
          Solo la persona propietaria puede cambiar estas políticas.
        </p>
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
