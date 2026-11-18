import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Navigate, useOutletContext } from "react-router";

import type { Me } from "../api/generated";
import {
  readMeQueryKey,
  renameOrganizationMutation,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { Panel } from "../components/ui/Panel.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { managesOrganization } from "../features/workspace/roles.ts";
import styles from "./OrganizationPage.module.css";

// Organización (API-022): el propietario administra los datos propios de su despacho, hoy su
// nombre. Equipo (quién entra) y Auditoría (qué hicieron) viven en sus propias pantallas; esta
// es la del despacho en sí.
export function OrganizationPage() {
  const me = useOutletContext<Me>();
  if (!managesOrganization(me.organization?.role) || !me.organization) {
    return <Navigate to={ROUTES.app} replace />;
  }
  return <NameCard organization={me.organization} />;
}

function NameCard({ organization }: { organization: { name: string } }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(organization.name);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const rename = useMutation({
    ...renameOrganizationMutation(),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: readMeQueryKey() });
    },
    onError: (err) => {
      const { status, detail } = apiProblem(err);
      setError(
        status === 422
          ? (detail ?? "Revise el nombre.")
          : "No pudimos guardar el cambio.",
      );
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setError(undefined);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Escriba el nombre de su despacho.");
      return;
    }
    rename.mutate({ body: { name: trimmed } });
  }

  return (
    <div>
      <title>{pageTitle("Organización")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Organización"
        description="Los datos propios de su despacho."
      />
      <Panel title="Nombre del despacho">
        <form className={styles.form} onSubmit={handleSubmit}>
          <Field
            label="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
            error={error}
            help="Aparece en los documentos y correos que envía su despacho."
          />
          {saved && (
            <Notice tone="success">Guardamos el nombre de su despacho.</Notice>
          )}
          <Button
            type="submit"
            busy={rename.isPending}
            disabled={rename.isPending || name.trim() === organization.name}
          >
            {rename.isPending ? "Guardando" : "Guardar"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
