import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router";

import type { Me } from "../../api/generated";
import {
  platformOperationsOptions,
  retryPlatformJobMutation,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { CirculoVistoIcon } from "../../components/ui/icons.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { PageHeader } from "../../components/ui/PageHeader.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { pageTitle } from "../../config/site.ts";
import styles from "./Platform.module.css";
import { DateText, Restricted } from "./shared.tsx";

// Qué hace cada tipo de tarea del trabajador, dicho como lo entiende quien opera.
const JOB_LABELS: Record<string, string> = {
  email_send: "Envío de correos",
  tsa_stamp: "Sellos de tiempo",
  export_build: "Paquetes de exportación",
  export_expire: "Vencimiento de paquetes",
  case_purge: "Eliminación de casos",
  payment_reconcile: "Conciliación de pagos",
  subscription_expire: "Vencimiento de planes",
  custody_anchor: "Anclaje de la custodia",
  renewal_charge: "Cobros de renovación",
  audit_anonymize: "Anonimización de registros",
};

// Operación: la cola del trabajador por tipo de tarea, las que fallaron (con la opción de
// reintentarlas) y los avisos de pago que esperan proceso.
export function PlatformOperationsPage() {
  const me = useOutletContext<Me>();
  const queryClient = useQueryClient();
  const operations = useQuery({
    ...platformOperationsOptions(),
    enabled: me.platform_admin,
    refetchInterval: 30_000,
  });
  const retry = useMutation({
    ...retryPlatformJobMutation(),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const data = operations.data;
  return (
    <div className={styles.screen}>
      <title>{pageTitle("Operación")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Tareas y pagos"
        description="Lo que el trabajador hace en segundo plano: correos, sellos de tiempo, exportaciones y cobros. Se actualiza cada 30 segundos."
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <>
          {operations.isPending && <p role="status">Cargando la operación</p>}
          {operations.isError && (
            <Notice tone="error">No pudimos cargar la operación.</Notice>
          )}
          {retry.isError && (
            <Notice tone="error">No pudimos reintentar la tarea.</Notice>
          )}
          {data && (
            <>
              <Panel title="Tareas que fallaron" density="compact">
                {data.failed.length === 0 ? (
                  <p className={styles.allClear}>
                    <CirculoVistoIcon size={18} aria-hidden="true" />
                    Ninguna tarea ha fallado.
                  </p>
                ) : (
                  <ul className={styles.rows}>
                    {data.failed.map((job) => (
                      <li key={job.id} className={styles.row}>
                        <span className={styles.rowMain}>
                          <strong>{JOB_LABELS[job.kind] ?? job.kind}</strong>
                          <span>
                            {job.attempts} intentos
                            {job.error && `, ${job.error}`}
                            {", última vez el "}
                            <DateText value={job.failed_at} />
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          busy={
                            retry.isPending &&
                            retry.variables?.path.job_id === job.id
                          }
                          onClick={() =>
                            retry.mutate({ path: { job_id: job.id } })
                          }
                        >
                          Reintentar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Cola por tipo de tarea" density="compact">
                {data.kinds.length === 0 ? (
                  <p className={styles.quiet}>La cola está vacía.</p>
                ) : (
                  <div className={styles.tableScroll}>
                    <table className={styles.table} role="table">
                      <thead role="rowgroup">
                        <tr role="row">
                          <th scope="col" role="columnheader">
                            Tarea
                          </th>
                          <th scope="col" role="columnheader">
                            En espera
                          </th>
                          <th scope="col" role="columnheader">
                            En curso
                          </th>
                          <th scope="col" role="columnheader">
                            Hechas en 24 h
                          </th>
                          <th scope="col" role="columnheader">
                            Fallidas
                          </th>
                        </tr>
                      </thead>
                      <tbody role="rowgroup">
                        {data.kinds.map((kind) => (
                          <tr role="row" key={kind.kind}>
                            <th scope="row" role="rowheader">
                              <span className={styles.cellTitle}>
                                {JOB_LABELS[kind.kind] ?? kind.kind}
                              </span>
                              {kind.oldest_waiting_at && (
                                <span className={styles.cellSub}>
                                  La más antigua espera desde el{" "}
                                  <DateText value={kind.oldest_waiting_at} />
                                </span>
                              )}
                            </th>
                            <td
                              role="cell"
                              data-label="En espera"
                              className={styles.number}
                            >
                              {kind.queued}
                            </td>
                            <td
                              role="cell"
                              data-label="En curso"
                              className={styles.number}
                            >
                              {kind.running}
                            </td>
                            <td
                              role="cell"
                              data-label="Hechas en 24 h"
                              className={styles.number}
                            >
                              {kind.done_24_hours}
                            </td>
                            <td role="cell" data-label="Fallidas">
                              {kind.failed > 0 ? (
                                <StatusBadge tone="error">
                                  {kind.failed}
                                </StatusBadge>
                              ) : (
                                <span className={styles.number}>0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
              <Panel title="Avisos de pago" density="compact">
                <p className={styles.quiet}>
                  {data.payment_events_pending === 0 ? (
                    "Todos los avisos de Wompi están procesados."
                  ) : (
                    <>
                      {data.payment_events_pending === 1
                        ? "Un aviso de Wompi espera proceso"
                        : `${data.payment_events_pending} avisos de Wompi esperan proceso`}
                      {data.oldest_payment_event_at && (
                        <>
                          , el más antiguo desde el{" "}
                          <DateText value={data.oldest_payment_event_at} />
                        </>
                      )}
                      .
                    </>
                  )}
                </p>
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}
