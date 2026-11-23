import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router";

import type { Me, OrganizationAuditAction } from "../api/generated";
import {
  listMembersOptions,
  organizationAuditPageOptions,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { sessionFetch } from "../api/sessionFetch.ts";
import { Button } from "../components/ui/Button.tsx";
import { DescargarIcon } from "../components/ui/icons.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { Panel } from "../components/ui/Panel.tsx";
import { Skeleton } from "../components/ui/Skeleton.tsx";
import { pageTitle } from "../config/site.ts";
import { managesTeam } from "../features/workspace/roles.ts";
import styles from "./OrganizationAuditPage.module.css";

const ACTION_LABELS: Record<string, string> = {
  user_registered: "Cuenta creada",
  email_verified: "Correo verificado",
  login: "Ingreso",
  login_failed: "Ingreso fallido",
  session_reuse_detected: "Reutilización de sesión detectada",
  sessions_revoked: "Sesiones cerradas",
  password_reset: "Contraseña restablecida",
  password_changed: "Contraseña cambiada",
  invitation_sent: "Invitación enviada",
  invitation_revoked: "Invitación revocada",
  invitation_accepted: "Invitación aceptada",
  role_changed: "Rol cambiado",
  member_removed: "Miembro retirado",
  organization_renamed: "Nombre del despacho actualizado",
  plan_changed: "Plan cambiado",
  subscription_canceled: "Suscripción cancelada",
  subscription_expired: "Suscripción vencida",
  courtesy_granted: "Cortesía concedida",
  courtesy_renewed: "Cortesía renovada",
  courtesy_revoked: "Cortesía revocada",
  account_blocked: "Cuenta bloqueada",
  account_unblocked: "Cuenta desbloqueada",
  account_closed: "Cuenta cerrada y anonimizada",
  legal_accepted: "Condiciones aceptadas",
  logout: "Salida",
  google_linked: "Cuenta de Google vinculada",
};

// Cuando el id ya no corresponde a ningún miembro actual (la persona salió del despacho), se
// muestra este texto en vez del identificador crudo.
const PERSON_GONE = "Persona que ya no está en el despacho";
const ACTIONS = Object.keys(ACTION_LABELS) as OrganizationAuditAction[];

function auditBoundary(date: string, endExclusive = false): string | undefined {
  if (!date) return undefined;
  const boundary = new Date(`${date}T00:00:00-05:00`);
  if (endExclusive) boundary.setUTCDate(boundary.getUTCDate() + 1);
  return boundary.toISOString();
}

export function OrganizationAuditPage() {
  const me = useOutletContext<Me>();
  const allowed = managesTeam(me.organization?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const [cursor, setCursor] = useState<string | undefined>();
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<
    "truncated" | "error" | null
  >(null);
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const actionValue = searchParams.get("accion") ?? "";
  const action = ACTIONS.includes(actionValue as OrganizationAuditAction)
    ? (actionValue as OrganizationAuditAction)
    : undefined;
  const actor = searchParams.get("persona") || undefined;
  const from = searchParams.get("desde") ?? "";
  const to = searchParams.get("hasta") ?? "";
  const filtering = Boolean(action || actor || from || to);
  // La exportación usa los mismos filtros que la lista. Es un enlace de descarga: el navegador
  // envía la cookie de sesión y el servidor vuelve a comprobar que sea gestor.
  const exportQuery = new URLSearchParams();
  if (action) exportQuery.set("action", action);
  if (actor) exportQuery.set("actor", actor);
  const exportFrom = auditBoundary(from);
  const exportTo = auditBoundary(to, true);
  if (exportFrom) exportQuery.set("created_from", exportFrom);
  if (exportTo) exportQuery.set("created_to", exportTo);
  const exportHref = `/api/v1/organization/audit/export${
    exportQuery.size > 0 ? `?${exportQuery}` : ""
  }`;

  // Se descarga con el cliente de sesión: si el acceso de diez minutos venció, se renueva y la
  // petición se repite; un enlace directo recibiría un 401. También lee el aviso de recorte.
  async function downloadAudit() {
    setExporting(true);
    setExportNotice(null);
    try {
      const response = await sessionFetch(
        new URL(exportHref, window.location.origin),
        {
          headers: { Accept: "text/csv" },
        },
      );
      if (!response.ok) {
        setExportNotice("error");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        /filename="([^"]+)"/.exec(
          response.headers.get("content-disposition") ?? "",
        )?.[1] ?? "auditoria-aletheia.csv";
      link.click();
      URL.revokeObjectURL(url);
      if (response.headers.get("x-rows-truncated") === "1")
        setExportNotice("truncated");
    } catch {
      setExportNotice("error");
    } finally {
      setExporting(false);
    }
  }
  const audit = useQuery({
    ...organizationAuditPageOptions({
      query: {
        cursor,
        action,
        actor,
        created_from: auditBoundary(from),
        created_to: auditBoundary(to, true),
      },
    }),
    enabled: allowed,
    placeholderData: keepPreviousData,
  });

  // Solo trae la primera página de miembros: alcanza para resolver nombres en un despacho normal.
  // Si el volumen de miembros crece mucho, esto debería paginar también o resolver por lote.
  const members = useQuery({
    ...listMembersOptions({ query: { limit: 100 } }),
    enabled: allowed,
  });
  const memberNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members.data?.items ?? []) {
      map.set(member.user_id, member.full_name);
    }
    return map;
  }, [members.data]);

  function setFilter(name: string, value: string) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
    setCursor(undefined);
    setPrevious([]);
  }

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Auditoría de seguridad")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Auditoría de seguridad"
        description="Consulte los eventos de acceso y administración de su despacho."
      />
      {!allowed ? (
        <Notice tone="error">Esta cuenta no administra el despacho.</Notice>
      ) : (
        <Panel title="Eventos de seguridad">
          <div className={styles.filters} aria-label="Filtros de auditoría">
            <label>
              <span>Acción</span>
              <select
                value={action ?? ""}
                onChange={(event) => setFilter("accion", event.target.value)}
              >
                <option value="">Todas las acciones</option>
                {ACTIONS.map((value) => (
                  <option key={value} value={value}>
                    {ACTION_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Persona</span>
              <select
                value={actor ?? ""}
                onChange={(event) => setFilter("persona", event.target.value)}
              >
                <option value="">Todas las personas</option>
                {(members.data?.items ?? []).map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Desde</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFilter("desde", event.target.value)}
              />
            </label>
            <label>
              <span>Hasta</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setFilter("hasta", event.target.value)}
              />
            </label>
            <Button
              size="sm"
              variant="secondary"
              busy={exporting}
              onClick={() => void downloadAudit()}
            >
              <DescargarIcon size={16} aria-hidden="true" />
              Descargar CSV
            </Button>
            {filtering && (
              <Button
                size="sm"
                variant="text"
                onClick={() => {
                  setSearchParams({}, { replace: true });
                  setCursor(undefined);
                  setPrevious([]);
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
          {exportNotice === "truncated" && (
            <Notice tone="warning">
              La descarga trae solo los 5000 eventos más recientes de este
              filtro. Acote las fechas o la acción para obtener el resto.
            </Notice>
          )}
          {exportNotice === "error" && (
            <Notice tone="error">
              No pudimos preparar la descarga. Inténtelo de nuevo en un momento.
            </Notice>
          )}
          {audit.isPending && (
            <div className={styles.loading}>
              <p role="status" className={styles.status}>
                Cargando eventos
              </p>
              <Skeleton height="2.5rem" />
              <Skeleton height="2.5rem" />
              <Skeleton height="2.5rem" />
            </div>
          )}
          {audit.isError && (
            <Notice tone="error">No pudimos cargar los eventos.</Notice>
          )}
          {audit.data?.items.length === 0 && (
            <p className={styles.empty}>
              {filtering
                ? "No encontramos eventos con estos filtros."
                : "No hay eventos en esta página."}
            </p>
          )}
          {audit.data && audit.data.items.length > 0 && (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Acción</th>
                    <th scope="col">Persona</th>
                    <th scope="col">Objeto</th>
                    <th scope="col">Dirección IP</th>
                    <th scope="col">Navegador</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data.items.map((event) => (
                    <tr key={event.id}>
                      <td data-label="Fecha">
                        <time dateTime={event.created_at}>
                          {new Date(event.created_at).toLocaleString("es-CO")}
                        </time>
                      </td>
                      <th scope="row" data-label="Acción">
                        {ACTION_LABELS[event.action] ??
                          event.action.replaceAll("_", " ")}
                      </th>
                      <td data-label="Persona">
                        <Person
                          id={event.actor_user_id}
                          names={memberNames}
                          fallback="Sistema"
                        />
                      </td>
                      <td data-label="Objeto">
                        <Person
                          id={event.target_id}
                          names={memberNames}
                          fallback="Sin objeto"
                        />
                      </td>
                      <td data-label="Dirección IP">
                        {event.ip ?? "No registrada"}
                      </td>
                      <td data-label="Navegador">
                        {event.user_agent ?? "No registrado"}
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

// Resuelve un id de persona a su nombre entre los miembros actuales; si ya no es miembro, se
// avisa en vez de mostrar el identificador crudo (que queda solo en title=, para depuración).
function Person({
  id,
  names,
  fallback,
}: {
  id: string | null;
  names: Map<string, string>;
  fallback: string;
}) {
  if (!id) return <>{fallback}</>;
  const name = names.get(id);
  return (
    <span className={styles.person} title={id}>
      {name ?? PERSON_GONE}
    </span>
  );
}
