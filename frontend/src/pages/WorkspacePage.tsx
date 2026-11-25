import { Navigate, useOutletContext } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { listCasesOptions } from "../api/generated/@tanstack/react-query.gen.ts";

import type { CaseSummaryOut, Me } from "../api/generated";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { greeting } from "../features/session/greeting.ts";
import { Panel } from "../components/ui/Panel.tsx";
import { StatTile } from "../components/ui/StatTile.tsx";
import { StatusBadge } from "../components/ui/StatusBadge.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { ResendVerification } from "../features/auth/ResendVerification.tsx";
import { EmailStatus } from "../features/session/EmailStatus.tsx";
import { OrganizationHealthPanel } from "../features/workspace/OrganizationHealthPanel.tsx";
import { PlanStatusNotice } from "../features/workspace/PlanStatusNotice.tsx";
import { TaskInbox } from "../features/workspace/TaskInbox.tsx";
import {
  managesOrganization,
  managesTeam,
  ROLE_LABELS,
} from "../features/workspace/roles.ts";
import { canOpenCases } from "../features/cases/roles.ts";
import { custodyActionLabel } from "../features/cases/custodyActions.ts";
import { formatRecentActivity } from "../features/cases/dates.ts";
import styles from "./WorkspacePage.module.css";
import {
  CarpetaAbiertaIcon,
  DiscoIcon,
  EdificioIcon,
  FlechaDerechaIcon,
  HuellaIcon,
  MasIcon,
  ReciboIcon,
  RelojIcon,
  SelloIcon,
  UsuariosIcon,
} from "../components/ui/icons.tsx";

const ACTION_TONE: Record<string, "ok" | "pending" | "error" | "muted"> = {
  evidence_stamped: "ok",
  chain_verified: "ok",
  evidence_stamp_failed: "error",
  case_closed: "muted",
  case_retention_updated: "muted",
  export_ready: "ok",
};

function toneForAction(action: string): "ok" | "pending" | "error" | "muted" {
  return ACTION_TONE[action] ?? "pending";
}

// Inicio del espacio de trabajo (HU-031): lo primero que ve la persona al ingresar. Un asistente
// no abre casos, así que su acción principal es distinta a la del resto del equipo; el
// propietario y el administrador además gestionan el despacho, así que ven accesos que un
// abogado no necesita. Nada aquí usa datos que la API no exponga ya en /me o en el libro de
// casos.
export function WorkspacePage() {
  const me = useOutletContext<Me>();
  const canCreate = canOpenCases(me.organization?.role);
  const canManageTeam = managesTeam(me.organization?.role);
  const canPay = me.permissions?.includes("billing.manage") ?? false;

  const totals = useQuery({
    ...listCasesOptions({ query: { status: "open", limit: 1 } }),
    enabled: me.organization != null && !me.platform_admin,
  });
  const recent = useQuery({
    ...listCasesOptions({ query: { status: "all", limit: 5 } }),
    enabled: me.organization != null && !me.platform_admin,
  });

  if (me.platform_admin) return <Navigate to={ROUTES.platform} replace />;

  // Acceso defensivo: una respuesta con otra forma (por ejemplo en una prueba que no simula
  // este endpoint) no debe tumbar la pantalla, solo se trata como «sin datos todavía».
  const caseTotals = totals.data?.totals;
  const recentItems = recent.data?.items;

  const hello = greeting(me.full_name);

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Espacio de trabajo")}</title>
      <meta name="robots" content="noindex" />

      <PageHeader
        title={hello}
        description={
          me.organization
            ? `${me.organization.name}, ${ROLE_LABELS[me.organization.role]}`
            : undefined
        }
        actions={
          me.organization && (
            <ButtonLink
              to={ROUTES.cases}
              size="sm"
              variant={me.email_verified ? "primary" : "secondary"}
            >
              <CarpetaAbiertaIcon size={16} aria-hidden="true" />
              {canCreate ? "Ver mis casos" : "Ver mis casos asignados"}
            </ButtonLink>
          )
        }
      />

      {me.organization && (
        <>
          <PlanStatusNotice subscription={me.subscription} canPay={canPay} />

          <section
            className={styles.overview}
            aria-label="Resumen de sus casos"
            aria-busy={totals.isPending}
          >
            <StatTile
              icon={CarpetaAbiertaIcon}
              label="Casos abiertos"
              value={
                caseTotals?.open ??
                (totals.isPending ? "Cargando" : "No disponible")
              }
            />
            <StatTile
              icon={DiscoIcon}
              label="En archivo histórico"
              value={
                caseTotals?.closed ??
                (totals.isPending ? "Cargando" : "No disponible")
              }
            />
            <StatTile
              icon={RelojIcon}
              label="Sellos de tiempo pendientes"
              value={
                caseTotals?.pending_stamps ??
                (totals.isPending ? "Cargando" : "No disponible")
              }
              note={
                caseTotals && caseTotals.pending_stamps > 0
                  ? "Evidencias esperando su sello."
                  : undefined
              }
            />
            <StatTile
              icon={HuellaIcon}
              label="Eventos de custodia"
              value={
                caseTotals?.custody_events ??
                (totals.isPending ? "Cargando" : "No disponible")
              }
            />
          </section>
          {totals.isError && (
            <p role="status" className={styles.note}>
              No pudimos cargar el resumen. Puede seguir trabajando desde la
              lista de casos.
            </p>
          )}

          {managesOrganization(me.organization?.role) && (
            <OrganizationHealthPanel />
          )}

          <TaskInbox me={me} />

          <Panel title="Actividad reciente">
            {recent.isPending && (
              <p role="status">Cargando la actividad reciente</p>
            )}
            {recent.isError && (
              <p role="status" className={styles.note}>
                No pudimos cargar la actividad reciente.
              </p>
            )}
            {recentItems && recentItems.length === 0 && (
              <EmptyState
                title={
                  canCreate ? "Todavía no hay casos" : "Nada asignado por ahora"
                }
                description={
                  canCreate
                    ? "Abra el primero y empiece a reunir el contexto de su equipo."
                    : "Cuando le asignen un caso, su actividad aparecerá aquí."
                }
                actions={
                  canCreate && me.email_verified ? (
                    <ButtonLink to={ROUTES.newCase} size="sm">
                      <MasIcon size={16} aria-hidden="true" />
                      Abrir un caso
                    </ButtonLink>
                  ) : undefined
                }
              />
            )}
            {recentItems && recentItems.length > 0 && (
              <ul className={styles.activity}>
                {recentItems.map((item: CaseSummaryOut) => (
                  <li key={item.id} className={styles.activityRow}>
                    <a
                      href={`${ROUTES.cases}/${item.id}`}
                      className={styles.activityLink}
                    >
                      <span className={styles.activityTitle}>{item.title}</span>
                      {item.last_event && (
                        <span className={styles.activityMeta}>
                          <StatusBadge
                            tone={toneForAction(item.last_event.action)}
                          >
                            {custodyActionLabel(item.last_event.action)}
                          </StatusBadge>
                          {item.last_event.actor_name && (
                            <span>por {item.last_event.actor_name}</span>
                          )}
                          <span>
                            {formatRecentActivity(item.last_activity_at)}
                          </span>
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Accesos rápidos" density="compact">
            <div className={styles.quickLinks}>
              {canCreate && me.email_verified && (
                <ButtonLink to={ROUTES.newCase} variant="secondary" size="sm">
                  <MasIcon size={16} aria-hidden="true" />
                  Abrir un caso
                </ButtonLink>
              )}
              <ButtonLink to={ROUTES.cases} variant="secondary" size="sm">
                <CarpetaAbiertaIcon size={16} aria-hidden="true" />
                Libro de casos
                <FlechaDerechaIcon size={14} aria-hidden="true" />
              </ButtonLink>
              {canManageTeam && (
                <ButtonLink to={ROUTES.members} variant="secondary" size="sm">
                  <UsuariosIcon size={16} aria-hidden="true" />
                  Equipo
                </ButtonLink>
              )}
              {managesOrganization(me.organization?.role) && (
                <ButtonLink
                  to={ROUTES.organization}
                  variant="secondary"
                  size="sm"
                >
                  <EdificioIcon size={16} aria-hidden="true" />
                  Organización
                </ButtonLink>
              )}
              {canManageTeam && (
                <ButtonLink
                  to={ROUTES.organizationAudit}
                  variant="secondary"
                  size="sm"
                >
                  <SelloIcon size={16} aria-hidden="true" />
                  Auditoría de seguridad
                </ButtonLink>
              )}
              {canPay && (
                <ButtonLink to={ROUTES.account} variant="secondary" size="sm">
                  <ReciboIcon size={16} aria-hidden="true" />
                  Plan y facturación
                </ButtonLink>
              )}
            </div>
          </Panel>
        </>
      )}

      {!me.organization && (
        <p className={styles.note}>
          Su cuenta ya no pertenece a ninguna organización. Para volver a
          trabajar en una, pida a su propietario que lo invite de nuevo.
        </p>
      )}

      {me.organization && (
        <p className={styles.identity}>
          <span translate="no">{me.email}</span>
          <EmailStatus verified={me.email_verified} />
        </p>
      )}

      {!me.email_verified && (
        <section className={styles.verify} aria-labelledby="titulo-verificar">
          <h2 id="titulo-verificar" className={styles.verifyTitle}>
            Verifique su correo
          </h2>
          <p className={styles.note}>
            Abra el enlace que le enviamos al crear la cuenta. Hasta entonces no
            podrá abrir casos. Si el enlace venció o no le llegó, pida uno
            nuevo.
          </p>
          <div className={styles.resend}>
            <ResendVerification email={me.email} />
          </div>
        </section>
      )}
    </div>
  );
}
