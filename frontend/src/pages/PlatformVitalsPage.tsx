import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useOutletContext } from "react-router";

import type { Me, VitalSummaryRow } from "../api/generated";
import { platformWebVitalsOptions } from "../api/generated/@tanstack/react-query.gen.ts";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { Panel } from "../components/ui/Panel.tsx";
import { StatTile } from "../components/ui/StatTile.tsx";
import { pageTitle } from "../config/site.ts";
import styles from "./PlatformPage.module.css";

const METRIC_LABELS: Record<VitalSummaryRow["metric"], string> = {
  LCP: "Contenido principal (LCP)",
  INP: "Respuesta al toque (INP)",
  CLS: "Estabilidad visual (CLS)",
  FCP: "Primer contenido (FCP)",
  TTFB: "Respuesta del servidor (TTFB)",
};
const DEVICE_LABELS: Record<VitalSummaryRow["device"], string> = {
  movil: "Móvil",
  escritorio: "Escritorio",
};
const RATING_LABELS: Record<VitalSummaryRow["rating"], string> = {
  good: "Bueno",
  "needs-improvement": "Por mejorar",
  poor: "Malo",
};
const WINDOWS = [7, 14, 30, 90] as const;

/** CLS no tiene unidad; el resto son milisegundos y desde 1 s se muestran en segundos. */
function format(metric: VitalSummaryRow["metric"], value: number): string {
  if (metric === "CLS") return value.toFixed(3);
  return value >= 1000
    ? `${(value / 1000).toLocaleString("es-CO", { maximumFractionDigits: 2 })} s`
    : `${Math.round(value)} ms`;
}

export function PlatformVitalsPage() {
  const me = useOutletContext<Me>();
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(14);
  const vitals = useQuery({
    ...platformWebVitalsOptions({ query: { days } }),
    enabled: me.platform_admin,
  });

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Rendimiento real")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Rendimiento real"
        description="Core Web Vitals de las visitas que aceptaron las cookies de analítica. Cada medida llega sin cuenta, IP ni navegador, y se borra a los 90 días."
      />
      {!me.platform_admin ? (
        <Notice tone="error">Esta cuenta no administra la plataforma.</Notice>
      ) : (
        <>
          <div className={styles.accountFilters}>
            <label className={styles.filterField}>
              Periodo
              <select
                value={days}
                onChange={(event) =>
                  setDays(
                    Number(event.target.value) as (typeof WINDOWS)[number],
                  )
                }
              >
                {WINDOWS.map((value) => (
                  <option key={value} value={value}>
                    Últimos {value} días
                  </option>
                ))}
              </select>
            </label>
          </div>
          {vitals.isPending && <p role="status">Cargando mediciones</p>}
          {vitals.isError && (
            <Notice tone="error">No pudimos cargar las mediciones.</Notice>
          )}
          {vitals.data && (
            <>
              <Panel title="Muestra">
                <div className={styles.stats}>
                  <StatTile
                    label="Medidas recibidas"
                    value={vitals.data.total_samples.toLocaleString("es-CO")}
                    note={`En los últimos ${vitals.data.days} días.`}
                  />
                </div>
              </Panel>
              <Panel
                title="Percentil 75 por versión"
                description="Así valora Google cada métrica: el 75 % de las visitas está por debajo de ese valor. Solo mide a quien aceptó la analítica, así que la muestra es más chica y puede inclinarse hacia quien acepta."
              >
                {vitals.data.rows.length === 0 ? (
                  <p>
                    Todavía no hay medidas en este periodo. Aparecen cuando
                    alguien acepta las cookies de analítica y navega.
                  </p>
                ) : (
                  <div className={styles.tableScroll}>
                    <table className={styles.table} role="table">
                      <thead role="rowgroup">
                        <tr role="row">
                          <th scope="col" role="columnheader">
                            Versión
                          </th>
                          <th scope="col" role="columnheader">
                            Pantalla
                          </th>
                          <th scope="col" role="columnheader">
                            Métrica
                          </th>
                          <th scope="col" role="columnheader">
                            Medidas
                          </th>
                          <th scope="col" role="columnheader">
                            P75
                          </th>
                          <th scope="col" role="columnheader">
                            En umbral bueno
                          </th>
                          <th scope="col" role="columnheader">
                            Valoración
                          </th>
                        </tr>
                      </thead>
                      <tbody role="rowgroup">
                        {vitals.data.rows.map((row) => (
                          <tr
                            role="row"
                            key={`${row.version}-${row.device}-${row.metric}`}
                          >
                            <th scope="row" role="rowheader">
                              {row.version}
                            </th>
                            <td role="cell" data-label="Pantalla">
                              {DEVICE_LABELS[row.device]}
                            </td>
                            <td role="cell" data-label="Métrica">
                              {METRIC_LABELS[row.metric]}
                            </td>
                            <td role="cell" data-label="Medidas">
                              {row.samples.toLocaleString("es-CO")}
                            </td>
                            <td role="cell" data-label="P75">
                              {format(row.metric, row.p75)}
                            </td>
                            <td role="cell" data-label="En umbral bueno">
                              {Math.round(row.good_share * 100)} %
                            </td>
                            <td role="cell" data-label="Valoración">
                              {RATING_LABELS[row.rating]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}
