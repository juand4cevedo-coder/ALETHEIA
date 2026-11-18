import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router";

import type { Me } from "../api/generated";
import {
  listMembersOptions,
  organizationAuditPageOptions,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
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
  plan_changed: "Plan cambiado",
  subscription_canceled: "Suscripción cancelada",
  subscription_expired: "Suscripción vencida",
  courtesy_granted: "Cortesía concedida",
  courtesy_renewed: "Cortesía renovada",
  courtesy_revoked: "Cortesía revocada",
  account_blocked: "Cuenta bloqueada",
  account_unblocked: "Cuenta desbloqueada",
  legal_accepted: "Condiciones aceptadas",
  logout: "Salida",
  google_linked: "Cuenta de Google vinculada",
};

// Cuando el id ya no corresponde a ningún miembro actual (la persona salió del despacho), se
// muestra este texto en vez del identificador crudo.
const PERSON_GONE = "Persona que ya no está en el despacho";

export function OrganizationAuditPage() {
  const me = useOutletContext<Me>();
  const allowed = managesTeam(me.organization?.role);
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const audit = useQuery({
    ...organizationAuditPageOptions({ query: cursor ? { cursor } : {} }),
    enabled: allowed,
  });

  // Solo trae la primera página de miembros: alcanza para resolver nombres en un despacho normal.
  // Si el volumen de miembros crece mucho, esto debería paginar también o resolver por lote.
  const members = useQuery({
    ...listMembersOptions({ query: {} }),
    enabled: allowed,
  });
  const memberNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members.data?.items ?? []) {
      map.set(member.user_id, member.full_name);
    }
    return map;
  }, [members.data]);

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
            <p className={styles.empty}>No hay eventos en esta página.</p>
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
