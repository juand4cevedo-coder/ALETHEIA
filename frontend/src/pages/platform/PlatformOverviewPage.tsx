import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useOutletContext } from "react-router";

import type { Me, PlatformOverview } from "../../api/generated";
import { platformOverviewOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import {
  BalanzaIcon,
  ChevronDerechaIcon,
  CirculoVistoIcon,
  PulsoIcon,
  ReciboIcon,
  RelojIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { PageHeader } from "../../components/ui/PageHeader.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { Skeleton } from "../../components/ui/Skeleton.tsx";
import { ROUTES } from "../../config/routes.ts";
import { pageTitle } from "../../config/site.ts";
import { formatBytes, formatCop } from "../../features/billing/format.ts";
import { greeting } from "../../features/session/greeting.ts";
import styles from "./Platform.module.css";
import { ACCESS_LABELS } from "./labels.ts";
import { DateText, Restricted } from "./shared.tsx";
import { SignupsChart } from "./SignupsChart.tsx";

/** El plan y de dónde viene el acceso, sin repetir la palabra cuando coinciden («Prueba»). */
function accessSummary(plan: string, source: string): string {
  const access = ACCESS_LABELS[source];
  if (!access || access.toLowerCase() === plan.toLowerCase()) return plan;
  return `${plan}, ${access.toLowerCase()}`;
}

type Attention = {
  to: string;
  icon: IconComponent;
  tone: "error" | "pending";
  title: string;
  detail: string;
};

/** Lo que pide una acción hoy, de lo más urgente a lo menos. Si no hay nada, no se muestra. */
function attentionItems(data: PlatformOverview): Attention[] {
  const items: Attention[] = [];
  if (data.tickets_overdue > 0)
    items.push({
      to: ROUTES.platformSupport,
      icon: BalanzaIcon,
      tone: "error",
      title:
        data.tickets_overdue === 1
          ? "Una solicitud con el plazo vencido"
          : `${data.tickets_overdue} solicitudes con el plazo vencido`,
      detail: "La ley fija la fecha de respuesta. Respóndalas primero.",
    });
  if (data.jobs_failed > 0)
    items.push({
      to: ROUTES.platformOperations,
      icon: PulsoIcon,
      tone: "error",
      title:
        data.jobs_failed === 1
          ? "Una tarea falló"
          : `${data.jobs_failed} tareas fallaron`,
      detail:
        "Correos, sellos o cobros que no terminaron. Puede reintentarlas.",
    });
  if (data.tickets_due_soon > 0)
    items.push({
      to: ROUTES.platformSupport,
      icon: RelojIcon,
      tone: "pending",
      title:
        data.tickets_due_soon === 1
          ? "Una solicitud vence esta semana"
          : `${data.tickets_due_soon} solicitudes vencen esta semana`,
      detail: "Aún están en plazo.",
    });
  if (data.payment_events_pending > 0)
    items.push({
      to: ROUTES.platformOperations,
      icon: ReciboIcon,
      tone: "pending",
      title:
        data.payment_events_pending === 1
          ? "Un aviso de pago sin procesar"
          : `${data.payment_events_pending} avisos de pago sin procesar`,
      detail: "Suelen resolverse solos en minutos.",
    });
  return items;
}

// Resumen de la plataforma: lo primero que ve la cuenta propietaria. Arriba, solo lo que exige
// una acción; después, las cifras del negocio y la actividad reciente. Nada de los expedientes.
export function PlatformOverviewPage() {
  const me = useOutletContext<Me>();
  const [hello] = useState(() => greeting(me.full_name));
  const overview = useQuery({
    ...platformOverviewOptions(),
    enabled: me.platform_admin,
  });
  const data = overview.data;
  const attention = data ? attentionItems(data) : [];
  const activeSubscriptions = data
    ? (data.subscriptions.active ?? 0) + (data.subscriptions.past_due ?? 0)
    : 0;

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Resumen de la plataforma")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title={hello}
        description="Así va ALETHEIA hoy: lo que necesita su atención, el negocio y la actividad reciente."
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <>
          {overview.isError && (
            <Notice tone="error">No pudimos cargar el resumen.</Notice>
          )}
          {overview.isPending && (
            <div className={styles.kpis} aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className={styles.kpi}>
                  <Skeleton height="14px" width="60%" />
                  <Skeleton height="32px" width="40%" />
                </div>
              ))}
            </div>
          )}
          {data && (
            <>
              <section aria-labelledby="atencion" className={styles.section}>
                <h2 id="atencion" className={styles.sectionTitle}>
                  Requiere su atención
                </h2>
                {attention.length === 0 ? (
                  <p className={styles.allClear}>
                    <CirculoVistoIcon size={18} aria-hidden="true" />
                    Todo al día: ninguna solicitud vencida ni tarea fallida.
                  </p>
                ) : (
                  <ul className={styles.attention}>
                    {attention.map((item) => (
                      <li key={item.title}>
                        <Link
                          to={item.to}
                          viewTransition
                          className={styles.attentionItem}
                          data-tone={item.tone}
                        >
                          <span className={styles.attentionIcon}>
                            <item.icon size={18} aria-hidden="true" />
                          </span>
                          <span className={styles.attentionText}>
                            <strong>{item.title}</strong>
                            <span>{item.detail}</span>
                          </span>
                          <ChevronDerechaIcon size={16} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <dl className={styles.kpis}>
                <div className={styles.kpi}>
                  <dt>Cuentas</dt>
                  <dd>{data.accounts_total.toLocaleString("es-CO")}</dd>
                  <dd className={styles.kpiNote}>
                    {data.accounts_new_7_days} nuevas esta semana
                    {data.accounts_blocked > 0 &&
                      `, ${data.accounts_blocked} bloqueadas`}
                  </dd>
                </div>
                <div className={styles.kpi}>
                  <dt>Despachos</dt>
                  <dd>{data.organizations_total.toLocaleString("es-CO")}</dd>
                  <dd className={styles.kpiNote}>
                    {data.subscriptions.trial ?? 0} en prueba
                    {data.organizations_read_only > 0 &&
                      `, ${data.organizations_read_only} en solo lectura`}
                  </dd>
                </div>
                <div className={styles.kpi}>
                  <dt>Suscripciones pagas</dt>
                  <dd>{activeSubscriptions.toLocaleString("es-CO")}</dd>
                  <dd className={styles.kpiNote}>
                    {(data.subscriptions.past_due ?? 0) > 0
                      ? `${data.subscriptions.past_due} con pago pendiente`
                      : "Todas al día"}
                  </dd>
                </div>
                <div className={styles.kpi}>
                  <dt>Cobrado en 30 días</dt>
                  <dd>{formatCop(data.collected_30_days_cop)}</dd>
                  <dd className={styles.kpiNote}>
                    {data.receipts_30_days === 1
                      ? "1 comprobante"
                      : `${data.receipts_30_days} comprobantes`}
                  </dd>
                </div>
              </dl>

              <div className={styles.split}>
                <Panel title="Crecimiento">
                  <SignupsChart days={data.signups} />
                </Panel>
                <Panel title="Vencen en los próximos 7 días" density="compact">
                  {data.expiring.length === 0 ? (
                    <p className={styles.quiet}>
                      Ningún plan, prueba ni cortesía vence esta semana.
                    </p>
                  ) : (
                    <ul className={styles.rows}>
                      {data.expiring.map((item) => (
                        <li key={item.organization_id} className={styles.row}>
                          <span className={styles.rowMain}>
                            <strong>{item.organization_name}</strong>
                            <span>
                              {accessSummary(
                                item.plan_name,
                                item.access_source,
                              )}
                            </span>
                          </span>
                          <span className={styles.rowMeta}>
                            <DateText value={item.ends_at} dateOnly />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    to={ROUTES.platformOrganizations}
                    className={styles.panelLink}
                  >
                    Ver todos los despachos
                  </Link>
                </Panel>
              </div>

              <div className={styles.split}>
                <Panel title="Cuentas nuevas" density="compact">
                  {data.recent_accounts.length === 0 ? (
                    <p className={styles.quiet}>Aún no hay cuentas.</p>
                  ) : (
                    <ul className={styles.rows}>
                      {data.recent_accounts.map((account) => (
                        <li key={account.id} className={styles.row}>
                          <span className={styles.rowMain}>
                            <strong>{account.full_name}</strong>
                            <span translate="no">{account.email}</span>
                          </span>
                          <span className={styles.rowMeta}>
                            <DateText value={account.created_at} dateOnly />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    to={ROUTES.platformAccounts}
                    className={styles.panelLink}
                  >
                    Ver todas las cuentas
                  </Link>
                </Panel>
                <Panel title="Operación" density="compact">
                  <dl className={styles.facts}>
                    <div>
                      <dt>Solicitudes abiertas</dt>
                      <dd>{data.tickets_open}</dd>
                    </div>
                    <div>
                      <dt>Tareas en cola</dt>
                      <dd>{data.jobs_waiting}</dd>
                    </div>
                    <div>
                      <dt>Almacenamiento usado</dt>
                      <dd>{formatBytes(data.storage_used_bytes)}</dd>
                    </div>
                  </dl>
                  <Link
                    to={ROUTES.platformOperations}
                    className={styles.panelLink}
                  >
                    Ver la operación
                  </Link>
                </Panel>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
