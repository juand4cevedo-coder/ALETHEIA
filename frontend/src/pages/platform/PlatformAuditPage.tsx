import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useOutletContext } from "react-router";

import type { Me } from "../../api/generated";
import { platformAuditOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { FilterPanel } from "../../components/ui/FilterPanel.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { PageHeader } from "../../components/ui/PageHeader.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { pageTitle } from "../../config/site.ts";
import styles from "./Platform.module.css";
import { useCursorPager } from "./pager.ts";
import { DateText, Pager, Restricted } from "./shared.tsx";

// Auditoría transversal: los eventos de seguridad y operación de toda la plataforma, con
// búsqueda y filtros que resuelve el servidor. Nunca muestra el contenido de un caso.
const ACTION_LABELS: Record<string, string> = {
  user_registered: "Cuenta creada",
  email_verified: "Correo verificado",
  login: "Ingreso",
  login_failed: "Ingreso fallido",
  google_linked: "Google vinculado",
  session_reuse_detected: "Reutilización de sesión detectada",
  password_reset: "Contraseña restablecida",
  password_changed: "Contraseña cambiada",
  sessions_revoked: "Sesiones cerradas",
  invitation_sent: "Invitación enviada",
  invitation_revoked: "Invitación revocada",
  invitation_accepted: "Invitación aceptada",
  role_changed: "Rol cambiado",
  member_removed: "Miembro retirado",
  plan_changed: "Plan cambiado",
  subscription_canceled: "Suscripción cancelada",
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
  legal_accepted: "Textos legales aceptados",
  logout: "Sesión cerrada",
  payment_approved: "Pago aprobado",
  payment_declined: "Pago rechazado",
  organization_renamed: "Organización renombrada",
  account_closed: "Cuenta cerrada",
  plan_updated: "Plan del catálogo editado",
  ownership_transferred: "Despacho entregado a otra persona",
  archive_exported: "Índice del archivo descargado",
  support_ticket_deleted: "Solicitud resuelta eliminada",
  platform_job_retried: "Tarea reintentada",
};

type AuditFilters = {
  search: string;
  action: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_AUDIT_FILTERS: AuditFilters = {
  search: "",
  action: "",
  createdFrom: "",
  createdTo: "",
};

export function PlatformAuditPage() {
  const me = useOutletContext<Me>();
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [filterError, setFilterError] = useState("");
  const pager = useCursorPager();
  const auditQuery = {
    search: appliedFilters.search || undefined,
    action: appliedFilters.action || undefined,
    created_from: appliedFilters.createdFrom
      ? new Date(appliedFilters.createdFrom).toISOString()
      : undefined,
    created_to: appliedFilters.createdTo
      ? new Date(appliedFilters.createdTo).toISOString()
      : undefined,
    cursor: pager.cursor,
  };
  const audit = useQuery({
    ...platformAuditOptions({ query: auditQuery }),
    enabled: me.platform_admin,
  });

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const from = filters.createdFrom
      ? new Date(filters.createdFrom)
      : undefined;
    const to = filters.createdTo ? new Date(filters.createdTo) : undefined;
    if (from && to && from >= to) {
      setFilterError("El inicio del periodo debe ser anterior al final.");
      return;
    }
    setFilterError("");
    pager.reset();
    setAppliedFilters({ ...filters, search: filters.search.trim() });
  }

  function clearFilters() {
    setFilterError("");
    pager.reset();
    setFilters(EMPTY_AUDIT_FILTERS);
    setAppliedFilters(EMPTY_AUDIT_FILTERS);
  }

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Auditoría de la plataforma")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Auditoría"
        description="Los eventos de seguridad y operación de toda la plataforma, sin abrir expedientes."
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <Panel density="compact">
          <FilterPanel
            active={Object.values(appliedFilters).filter(Boolean).length}
          >
            <form
              className={styles.accountFilters}
              aria-label="Filtrar auditoría"
              onSubmit={applyFilters}
            >
              <Field
                label="Persona, organización u objeto"
                type="search"
                maxLength={120}
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
              />
              <Select
                label="Acción"
                value={filters.action}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    action: event.target.value,
                  }))
                }
                options={[
                  { value: "", label: "Todas" },
                  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
              <Field
                label="Desde"
                type="datetime-local"
                value={filters.createdFrom}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    createdFrom: event.target.value,
                  }))
                }
              />
              <Field
                label="Hasta"
                type="datetime-local"
                value={filters.createdTo}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    createdTo: event.target.value,
                  }))
                }
              />
              <div className={styles.filterActions}>
                <Button size="sm" type="submit">
                  Aplicar filtros
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={clearFilters}
                >
                  Limpiar
                </Button>
              </div>
            </form>
          </FilterPanel>
          {filterError && <Notice tone="error">{filterError}</Notice>}
          {audit.isPending && <p role="status">Cargando eventos</p>}
          {audit.isError && (
            <Notice tone="error">No pudimos cargar los eventos.</Notice>
          )}
          {audit.data?.items.length === 0 && (
            <p className={styles.empty}>
              No hay eventos que coincidan con los filtros.
            </p>
          )}
          {audit.data && (
            <p className={styles.resultCount} role="status">
              {audit.data.total === 1
                ? "1 evento encontrado"
                : `${audit.data.total} eventos encontrados`}
            </p>
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
          <Pager pager={pager} next={audit.data?.next_cursor} />
        </Panel>
      )}
    </div>
  );
}
