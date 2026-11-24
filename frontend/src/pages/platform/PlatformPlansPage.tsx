import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useOutletContext } from "react-router";

import type { Me, PlatformPlan } from "../../api/generated";
import {
  grantCourtesyMutation,
  lookupCourtesyOptions,
  platformBillingOptions,
  revokeCourtesyMutation,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { PageHeader } from "../../components/ui/PageHeader.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { pageTitle } from "../../config/site.ts";
import styles from "./Platform.module.css";
import { PlatformPlanDialog } from "./PlatformPlanDialog.tsx";
import { ACCESS_LABELS, money, SUBSCRIPTION_LABELS } from "./labels.ts";
import { DateText, Restricted } from "./shared.tsx";

// Planes y cortesías: el catálogo que ven los clientes y la asignación manual de un plan a un
// despacho. Ninguna de las dos cosas cobra ni emite facturas; cada cambio queda en la auditoría.
export function PlatformPlansPage() {
  const me = useOutletContext<Me>();
  const [editing, setEditing] = useState<PlatformPlan | null>(null);
  const billing = useQuery({
    ...platformBillingOptions(),
    enabled: me.platform_admin,
  });
  return (
    <div className={styles.screen}>
      <title>{pageTitle("Planes y cortesías")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Planes y cortesías"
        description="Ajuste el catálogo que ven los clientes y asigne un plan a un despacho sin entrar a sus casos."
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <>
          {billing.isPending && <p role="status">Cargando los planes</p>}
          {billing.isError && (
            <Notice tone="error">No pudimos cargar los planes.</Notice>
          )}
          {billing.data && (
            <>
              <Panel
                title="Planes del catálogo"
                description="Precios, usuarios incluidos y visibilidad de cada plan. Un precio nuevo se avisa a los clientes con 30 días de anticipación y solo rige desde su siguiente renovación."
                density="compact"
              >
                <div className={styles.tableScroll}>
                  <table className={styles.table} role="table">
                    <thead role="rowgroup">
                      <tr role="row">
                        <th scope="col" role="columnheader">
                          Plan
                        </th>
                        <th scope="col" role="columnheader">
                          Mensual
                        </th>
                        <th scope="col" role="columnheader">
                          Anual
                        </th>
                        <th scope="col" role="columnheader">
                          Usuarios incluidos
                        </th>
                        <th scope="col" role="columnheader">
                          En precios
                        </th>
                        <th scope="col" role="columnheader">
                          <span className="visually-hidden">Acciones</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody role="rowgroup">
                      {billing.data.plans.map((plan) => (
                        <tr role="row" key={plan.code}>
                          <th scope="row" role="rowheader">
                            {plan.name}
                          </th>
                          <td
                            role="cell"
                            data-label="Mensual"
                            className={styles.number}
                          >
                            {money(plan.monthly_price_cop)}
                          </td>
                          <td
                            role="cell"
                            data-label="Anual"
                            className={styles.number}
                          >
                            {money(plan.annual_price_cop)}
                          </td>
                          <td
                            role="cell"
                            data-label="Usuarios incluidos"
                            className={styles.number}
                          >
                            {plan.included_users}
                          </td>
                          <td role="cell" data-label="En precios">
                            <StatusBadge tone={plan.is_public ? "ok" : "muted"}>
                              {plan.is_public ? "Publicado" : "Por cotización"}
                            </StatusBadge>
                          </td>
                          <td role="cell" className={styles.rowAction}>
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label={`Editar el plan ${plan.name}`}
                              onClick={() => setEditing(plan)}
                            >
                              Editar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <PlanAccessManager plans={billing.data.plans} />
              <PlatformPlanDialog
                key={editing?.code ?? "ninguno"}
                plan={editing}
                onClose={() => setEditing(null)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function PlanAccessManager({
  plans,
}: {
  plans: { code: string; name: string }[];
}) {
  const [email, setEmail] = useState("");
  const [searched, setSearched] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [reason, setReason] = useState("");
  const [end, setEnd] = useState("");
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const target = useQuery({
    ...lookupCourtesyOptions({ query: { account_email: searched } }),
    enabled: Boolean(searched),
  });
  const grant = useMutation({
    ...grantCourtesyMutation(),
    onSuccess: async () => {
      setMessage("El acceso al plan quedó registrado.");
      setReason("");
      await queryClient.invalidateQueries();
    },
    onError: () => setMessage("No pudimos registrar el acceso al plan."),
  });
  const revoke = useMutation({
    ...revokeCourtesyMutation(),
    onSuccess: async () => {
      setMessage("El acceso quedó revocado. El despacho está en solo lectura.");
      setReason("");
      await queryClient.invalidateQueries();
    },
    onError: () => setMessage("No pudimos revocar el acceso."),
  });
  const selectedPlan = plans.find((plan) => plan.code === planCode);
  const busy = grant.isPending || revoke.isPending;

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSearched(email.trim().toLowerCase());
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target.data || !selectedPlan || reason.trim().length < 10) return;
    const endsAt = end ? new Date(end) : null;
    if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= new Date())) {
      setMessage("El vencimiento debe ser posterior a este momento.");
      return;
    }
    const deadline = endsAt
      ? endsAt.toLocaleString("es-CO")
      : "sin vencimiento";
    if (
      !window.confirm(
        `¿Confirma ${selectedPlan.name} para ${target.data.organization_name} (${target.data.account_email}), ${deadline}?`,
      )
    )
      return;
    setMessage("");
    grant.mutate({
      body: {
        organization_id: target.data.organization_id,
        account_email: target.data.account_email,
        plan_code: selectedPlan.code,
        reason: reason.trim(),
        ends_at: endsAt?.toISOString() ?? null,
      },
    });
  }

  function revokeCurrent() {
    if (!target.data || reason.trim().length < 10) {
      setMessage("Escriba un motivo de al menos 10 caracteres.");
      return;
    }
    if (
      !window.confirm(
        `¿Revocar el acceso de ${target.data.organization_name}? El despacho pasará a solo lectura.`,
      )
    )
      return;
    setMessage("");
    revoke.mutate({
      body: {
        organization_id: target.data.organization_id,
        account_email: target.data.account_email,
        reason: reason.trim(),
      },
    });
  }

  return (
    <Panel
      title="Asignación de planes"
      description="Busque el despacho por el correo de cualquiera de sus miembros. Puede darle un plan, renovarlo o revocarlo; el motivo queda en la auditoría."
    >
      <div className={styles.courtesy}>
        <form className={styles.searchRow} onSubmit={search}>
          <Field
            label="Correo de cualquier miembro"
            type="email"
            required
            value={email}
            autoComplete="off"
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" variant="secondary">
            Buscar cuenta
          </Button>
        </form>
        {target.isPending && searched && (
          <p role="status" className={styles.note}>
            Buscando el despacho
          </p>
        )}
        {target.isError && (
          <Notice tone="error">
            No encontramos un despacho asociado a esa cuenta.
          </Notice>
        )}
        {target.data && (
          <div className={styles.courtesyGrid}>
            <dl className={styles.targetCard}>
              <div className={styles.targetTitle}>
                <dt className="visually-hidden">Despacho</dt>
                <dd>{target.data.organization_name}</dd>
              </div>
              <div>
                <dt>Cuenta</dt>
                <dd>
                  {target.data.account_name}, {target.data.account_email}
                </dd>
              </div>
              <div>
                <dt>Plan actual</dt>
                <dd>
                  {plans.find((plan) => plan.code === target.data.plan_code)
                    ?.name ?? target.data.plan_code}
                  {", "}
                  {SUBSCRIPTION_LABELS[target.data.status] ??
                    target.data.status}
                </dd>
              </div>
              <div>
                <dt>Acceso</dt>
                <dd>{ACCESS_LABELS[target.data.access_source] ?? "Otro"}</dd>
              </div>
              {target.data.ends_at && (
                <div>
                  <dt>Vence</dt>
                  <dd>
                    <DateText value={target.data.ends_at} />
                  </dd>
                </div>
              )}
              {target.data.granted_at && (
                <div>
                  <dt>Última concesión</dt>
                  <dd>
                    <DateText value={target.data.granted_at} />
                  </dd>
                </div>
              )}
              {target.data.revoked_at && (
                <div>
                  <dt>Revocada</dt>
                  <dd>
                    <DateText value={target.data.revoked_at} />
                  </dd>
                </div>
              )}
            </dl>
            <form className={styles.form} onSubmit={submit}>
              <Select
                label="Plan que tendrá el despacho"
                required
                value={planCode}
                onChange={(event) => setPlanCode(event.target.value)}
                options={[
                  { value: "", label: "Seleccione un plan" },
                  ...plans
                    .filter((plan) => plan.code !== "trial")
                    .map((plan) => ({ value: plan.code, label: plan.name })),
                ]}
              />
              <Field
                label="Vencimiento (opcional)"
                type="datetime-local"
                value={end}
                help="Sin fecha, el plan queda asignado hasta que lo revoque."
                onChange={(event) => setEnd(event.target.value)}
              />
              <Field
                label="Motivo interno"
                multiline
                rows={3}
                minLength={10}
                maxLength={500}
                required
                value={reason}
                help="Al menos 10 caracteres. Solo lo ve la plataforma."
                onChange={(event) => setReason(event.target.value)}
              />
              <div className={styles.formActions}>
                <Button type="submit" busy={busy}>
                  Asignar o renovar plan
                </Button>
                {target.data.access_source === "courtesy" &&
                  target.data.status === "active" && (
                    <Button
                      variant="danger"
                      busy={busy}
                      onClick={revokeCurrent}
                    >
                      Revocar acceso
                    </Button>
                  )}
              </div>
            </form>
          </div>
        )}
        {message && (
          <p role="status" className={styles.note}>
            {message}
          </p>
        )}
      </div>
    </Panel>
  );
}
