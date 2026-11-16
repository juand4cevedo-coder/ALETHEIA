import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useOutletContext } from "react-router";

import type { Me } from "../api/generated";
import { organizationAuditPageOptions } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { pageTitle } from "../config/site.ts";
import { managesTeam } from "../features/workspace/roles.ts";
import styles from "./PlatformPage.module.css";

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

export function OrganizationAuditPage() {
  const me = useOutletContext<Me>();
  const allowed = managesTeam(me.organization?.role);
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const audit = useQuery({
    ...organizationAuditPageOptions({ query: cursor ? { cursor } : {} }),
    enabled: allowed,
  });

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
        <section className={styles.section} aria-label="Eventos de seguridad">
          {audit.isPending && <p role="status">Cargando eventos</p>}
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
                      <td>
                        <time dateTime={event.created_at}>
                          {new Date(event.created_at).toLocaleString("es-CO")}
                        </time>
                      </td>
                      <th scope="row">
                        {ACTION_LABELS[event.action] ??
                          event.action.replaceAll("_", " ")}
                      </th>
                      <td className={styles.identifier}>
                        {event.actor_user_id ?? "Sistema"}
                      </td>
                      <td className={styles.identifier}>
                        {event.target_id ?? "Sin objeto"}
                      </td>
                      <td>{event.ip ?? "No registrada"}</td>
                      <td>{event.user_agent ?? "No registrado"}</td>
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
        </section>
      )}
    </div>
  );
}
