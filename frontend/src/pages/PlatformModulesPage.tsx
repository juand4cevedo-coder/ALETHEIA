import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useOutletContext } from "react-router";

import type { Me, SupportTicketOut } from "../api/generated";
import {
  changeSupportTicketStatusMutation,
  grantCourtesyMutation,
  lookupCourtesyOptions,
  platformAuditOptions,
  platformBillingOptions,
  platformSupportTicketsOptions,
  revokeCourtesyMutation,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { Panel } from "../components/ui/Panel.tsx";
import { StatTile } from "../components/ui/StatTile.tsx";
import { pageTitle } from "../config/site.ts";
import styles from "./PlatformPage.module.css";

function Restricted() {
  return <Notice tone="error">Esta cuenta no administra la plataforma.</Notice>;
}

function DateText({ value }: { value: string }) {
  return (
    <time dateTime={value}>{new Date(value).toLocaleString("es-CO")}</time>
  );
}

function money(value: number | null) {
  return value === null
    ? "Por cotización"
    : `$${value.toLocaleString("es-CO")}`;
}

const STATUS_LABELS: Record<string, string> = {
  trial: "Prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  expired: "Vencida",
};

export function PlatformBillingPage() {
  const me = useOutletContext<Me>();
  const billing = useQuery({
    ...platformBillingOptions(),
    enabled: me.platform_admin,
  });
  return (
    <div className={styles.screen}>
      <title>{pageTitle("Facturación de la plataforma")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Facturación"
        description="Consulte los planes y el estado comercial registrado en Aletheia."
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <>
          {billing.isPending && <p role="status">Cargando facturación</p>}
          {billing.isError && (
            <Notice tone="error">No pudimos cargar la facturación.</Notice>
          )}
          {billing.data && (
            <>
              <Panel title="Notificaciones de pago">
                <div className={styles.stats}>
                  <StatTile
                    label="Recibidas"
                    value={billing.data.payment_events_received}
                  />
                  <StatTile
                    label="Sin procesar"
                    value={billing.data.payment_events_pending}
                    note={
                      billing.data.payment_events_pending > 0
                        ? "Esperando que Wompi confirme el pago."
                        : undefined
                    }
                  />
                </div>
              </Panel>
              <Panel title="Suscripciones por estado">
                <div className={styles.stats}>
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <StatTile
                      key={status}
                      label={label}
                      value={billing.data.subscription_counts[status] ?? 0}
                    />
                  ))}
                </div>
              </Panel>
              <Panel
                title="Planes del catálogo"
                description="Este panel refleja los registros actuales. No emite facturas ni cobra pagos."
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
                      </tr>
                    </thead>
                    <tbody role="rowgroup">
                      {billing.data.plans.map((plan) => (
                        <tr role="row" key={plan.code}>
                          <th scope="row" role="rowheader">
                            {plan.name}
                          </th>
                          <td role="cell" data-label="Mensual">
                            {money(plan.monthly_price_cop)}
                          </td>
                          <td role="cell" data-label="Anual">
                            {money(plan.annual_price_cop)}
                          </td>
                          <td role="cell" data-label="Usuarios incluidos">
                            {plan.included_users}
                          </td>
                          <td role="cell" data-label="En precios">
                            {plan.is_public ? "Sí" : "Por cotización"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <PlanAccessManager plans={billing.data.plans} />
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
    ...lookupCourtesyOptions({ query: { owner_email: searched } }),
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
        `Confirma ${selectedPlan.name} para ${target.data.organization_name} (${target.data.owner_email}), ${deadline}?`,
      )
    )
      return;
    setMessage("");
    grant.mutate({
      body: {
        organization_id: target.data.organization_id,
        owner_email: target.data.owner_email,
        plan_code: selectedPlan.code,
        reason: reason.trim(),
        ends_at: endsAt?.toISOString() ?? null,
      },
    });
  }

  function revokeCurrent() {
    if (!target.data || reason.trim().length < 10) {
      setMessage("Escribe un motivo de al menos 10 caracteres.");
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
        owner_email: target.data.owner_email,
        reason: reason.trim(),
      },
    });
  }

  return (
    <Panel
      title="Asignación de planes"
      description="Otorgue, cambie o revoque el plan de cualquier despacho registrado, sin entrar a sus casos."
    >
      <div className={styles.courtesy}>
        <form className={styles.form} onSubmit={search}>
          <label htmlFor="courtesy-email">
            Correo del responsable del despacho
          </label>
          <div className={styles.inlineForm}>
            <input
              id="courtesy-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button type="submit">Buscar cuenta</Button>
          </div>
        </form>
        {target.isPending && searched && <p role="status">Buscando despacho</p>}
        {target.isError && (
          <Notice tone="error">
            No encontramos un despacho asociado a esa cuenta responsable.
          </Notice>
        )}
        {target.data && (
          <>
            <div className={styles.targetCard}>
              <strong>{target.data.organization_name}</strong>
              <span>
                {target.data.owner_name}, {target.data.owner_email}
              </span>
              <span>
                Plan actual:{" "}
                {plans.find((plan) => plan.code === target.data.plan_code)
                  ?.name ?? target.data.plan_code}
                {", "}
                {STATUS_LABELS[target.data.status] ?? target.data.status}
              </span>
              <span>
                Acceso:{" "}
                {target.data.access_source === "courtesy"
                  ? "Asignado por la plataforma"
                  : target.data.access_source === "trial"
                    ? "Prueba"
                    : "Otro"}
              </span>
              {target.data.ends_at && (
                <span>
                  Vence: <DateText value={target.data.ends_at} />
                </span>
              )}
              {target.data.granted_at && (
                <span>
                  Última concesión: <DateText value={target.data.granted_at} />
                </span>
              )}
              {target.data.revoked_at && (
                <span>
                  Revocada: <DateText value={target.data.revoked_at} />
                </span>
              )}
            </div>
            <form className={styles.form} onSubmit={submit}>
              <label htmlFor="courtesy-plan">Plan que tendrá el despacho</label>
              <select
                id="courtesy-plan"
                required
                value={planCode}
                onChange={(event) => setPlanCode(event.target.value)}
              >
                <option value="">Seleccione un plan</option>
                {plans
                  .filter((plan) => plan.code !== "trial")
                  .map((plan) => (
                    <option key={plan.code} value={plan.code}>
                      {plan.name}
                    </option>
                  ))}
              </select>
              <label htmlFor="courtesy-end">Vencimiento (opcional)</label>
              <input
                id="courtesy-end"
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
              <label htmlFor="courtesy-reason">Motivo interno</label>
              <textarea
                id="courtesy-reason"
                minLength={10}
                maxLength={500}
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <div className={styles.inlineForm}>
                <Button type="submit" busy={busy}>
                  Asignar o renovar plan
                </Button>
                {target.data.access_source === "courtesy" &&
                  target.data.status === "active" && (
                    <Button
                      variant="secondary"
                      busy={busy}
                      onClick={revokeCurrent}
                    >
                      Revocar acceso
                    </Button>
                  )}
              </div>
            </form>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </Panel>
  );
}

export function PlatformSupportPage() {
  const me = useOutletContext<Me>();
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const [error, setError] = useState(false);
  const queryClient = useQueryClient();
  const tickets = useQuery({
    ...platformSupportTicketsOptions({ query: cursor ? { cursor } : {} }),
    enabled: me.platform_admin,
  });
  const change = useMutation({
    ...changeSupportTicketStatusMutation(),
    onSuccess: async () => {
      setError(false);
      await queryClient.invalidateQueries();
    },
    onError: () => setError(true),
  });
  const update = (ticket: SupportTicketOut) =>
    change.mutate({
      path: { ticket_id: ticket.id },
      body: { status: ticket.status === "open" ? "closed" : "open" },
    });
  return (
    <div className={styles.screen}>
      <title>{pageTitle("Soporte de la plataforma")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Solicitudes de usuarios"
        description="Revise y resuelva las solicitudes enviadas desde las cuentas de Aletheia."
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <Panel title="Solicitudes">
          {tickets.isPending && <p role="status">Cargando solicitudes</p>}
          {tickets.isError && (
            <Notice tone="error">No pudimos cargar las solicitudes.</Notice>
          )}
          {error && (
            <Notice tone="error">
              No pudimos cambiar el estado de la solicitud.
            </Notice>
          )}
          {tickets.data?.items.length === 0 && (
            <p className={styles.empty}>No hay solicitudes en esta página.</p>
          )}
          {tickets.data?.items.map((ticket) => (
            <article className={styles.ticket} key={ticket.id}>
              <div className={styles.ticketHead}>
                <h2>{ticket.subject}</h2>
                <span>{ticket.status === "open" ? "Abierta" : "Cerrada"}</span>
              </div>
              <p className={styles.note}>
                {ticket.user_email}, <DateText value={ticket.created_at} />
              </p>
              <p className={styles.message}>{ticket.message}</p>
              <Button
                size="sm"
                variant="secondary"
                disabled={change.isPending}
                onClick={() => update(ticket)}
              >
                {ticket.status === "open" ? "Marcar como resuelta" : "Reabrir"}
              </Button>
            </article>
          ))}
          <div className={styles.pager}>
            {previous.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCursor(previous.at(-1));
                  setPrevious((items) => items.slice(0, -1));
                }}
              >
                Anterior
              </Button>
            )}
            {tickets.data?.next_cursor && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPrevious((items) => [...items, cursor]);
                  setCursor(tickets.data.next_cursor ?? undefined);
                }}
              >
                Ver más
              </Button>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  user_registered: "Cuenta creada",
  email_verified: "Correo verificado",
  login: "Ingreso",
  login_failed: "Ingreso fallido",
  password_reset: "Contraseña restablecida",
  password_changed: "Contraseña cambiada",
  sessions_revoked: "Sesiones cerradas",
  role_changed: "Rol cambiado",
  member_removed: "Miembro retirado",
  case_created: "Caso abierto",
  case_closed: "Caso cerrado y archivado",
  case_reopened: "Caso reabierto",
  case_retention_updated: "Conservación del caso actualizada",
  case_task_created: "Tarea de caso creada",
  case_task_status_changed: "Estado de tarea actualizado",
  account_blocked: "Cuenta bloqueada",
  account_unblocked: "Cuenta desbloqueada",
  platform_admin_granted: "Propietario asignado",
  support_ticket_opened: "Solicitud de soporte creada",
  support_ticket_closed: "Solicitud de soporte cerrada",
  support_ticket_reopened: "Solicitud de soporte reabierta",
  courtesy_granted: "Cortesía concedida",
  courtesy_renewed: "Cortesía renovada",
  courtesy_revoked: "Cortesía revocada",
  subscription_expired: "Suscripción vencida",
};

export function PlatformAuditPage() {
  const me = useOutletContext<Me>();
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const audit = useQuery({
    ...platformAuditOptions({ query: cursor ? { cursor } : {} }),
    enabled: me.platform_admin,
  });
  return (
    <div className={styles.screen}>
      <title>{pageTitle("Auditoría de la plataforma")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Auditoría"
        description="Consulte los eventos de seguridad y operación de la plataforma sin abrir expedientes."
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <Panel title="Eventos">
          {audit.isPending && <p role="status">Cargando eventos</p>}
          {audit.isError && (
            <Notice tone="error">No pudimos cargar los eventos.</Notice>
          )}
          {audit.data?.items.length === 0 && (
            <p className={styles.empty}>No hay eventos en esta página.</p>
          )}
          {audit.data && audit.data.items.length > 0 && (
            <div className={styles.tableScroll}>
              <table className={styles.table} role="table">
                <thead role="rowgroup">
                  <tr role="row">
                    <th scope="col" role="columnheader">
                      Fecha
                    </th>
                    <th scope="col" role="columnheader">
                      Acción
                    </th>
                    <th scope="col" role="columnheader">
                      Persona
                    </th>
                    <th scope="col" role="columnheader">
                      Organización
                    </th>
                    <th scope="col" role="columnheader">
                      Objeto
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {audit.data.items.map((event) => (
                    <tr role="row" key={event.id}>
                      <td role="cell" data-label="Fecha">
                        <DateText value={event.created_at} />
                      </td>
                      <th scope="row" role="rowheader">
                        {ACTION_LABELS[event.action] ??
                          event.action.replaceAll("_", " ")}
                      </th>
                      <td role="cell" data-label="Persona">
                        {event.actor_name ?? "Sistema"}
                      </td>
                      <td role="cell" data-label="Organización">
                        {event.organization_name ?? "Plataforma"}
                      </td>
                      <td
                        role="cell"
                        data-label="Objeto"
                        className={styles.identifier}
                      >
                        {event.target_id ?? "Sin objeto"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className={styles.pager}>
            {previous.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCursor(previous.at(-1));
                  setPrevious((items) => items.slice(0, -1));
                }}
              >
                Anterior
              </Button>
            )}
            {audit.data?.next_cursor && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPrevious((items) => [...items, cursor]);
                  setCursor(audit.data.next_cursor ?? undefined);
                }}
              >
                Ver más
              </Button>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
