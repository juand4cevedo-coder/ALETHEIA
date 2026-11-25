import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useOutletContext } from "react-router";

import type { Me, VitalSummaryRow } from "../../api/generated";
import { platformWebVitalsOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Meter } from "../../components/ui/Meter.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { PageHeader } from "../../components/ui/PageHeader.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { SegmentedControl } from "../../components/ui/SegmentedControl.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { pageTitle } from "../../config/site.ts";
import styles from "./Platform.module.css";
import { Restricted } from "./shared.tsx";
import {
  compareVersions,
  formatVital,
  KEY_METRICS,
  METRIC_INFO,
  SECONDARY_METRICS,
} from "./vitals.ts";

const DEVICE_LABELS: Record<VitalSummaryRow["device"], string> = {
  movil: "Celular",
  escritorio: "Escritorio",
};
const RATING_LABELS: Record<VitalSummaryRow["rating"], string> = {
  good: "Bueno",
  "needs-improvement": "Por mejorar",
  poor: "Lento",
};
const RATING_TONE: Record<
  VitalSummaryRow["rating"],
  "ok" | "pending" | "error"
> = {
  good: "ok",
  "needs-improvement": "pending",
  poor: "error",
};
const WINDOWS = ["7", "14", "30", "90"] as const;
/** Por debajo de esta cantidad de medidas, un percentil no dice mucho. */
const SMALL_SAMPLE = 30;

function MetricCard({
  row,
  previous,
}: {
  row: VitalSummaryRow;
  previous: VitalSummaryRow | undefined;
}) {
  const info = METRIC_INFO[row.metric];
  const change = previous ? row.p75 - previous.p75 : null;
  const better = change !== null && change < 0;
  return (
    <article className={styles.vitalCard}>
      <div className={styles.vitalHead}>
        <h3>{info.question}</h3>
        <StatusBadge tone={RATING_TONE[row.rating]}>
          {RATING_LABELS[row.rating]}
        </StatusBadge>
      </div>
      <p className={styles.vitalValue}>{formatVital(row.metric, row.p75)}</p>
      <p className={styles.note}>
        {info.name}. Bueno hasta {info.good}.
      </p>
      <Meter
        label="Visitas en el umbral bueno"
        value={row.good_share * 100}
        valueText={`${Math.round(row.good_share * 100)} %`}
        tone={
          row.rating === "good"
            ? "ok"
            : row.rating === "poor"
              ? "error"
              : "warn"
        }
      />
      <p className={styles.note}>
        {change === null || Math.abs(change) < info.noise
          ? previous
            ? `Igual que en la versión ${previous.version}.`
            : "Sin versión anterior para comparar."
          : `${better ? "Mejoró" : "Empeoró"} ${formatVital(row.metric, Math.abs(change))} frente a la versión ${previous!.version}.`}
        {row.samples < SMALL_SAMPLE &&
          ` Solo ${row.samples} medidas: tome el dato con cautela.`}
      </p>
    </article>
  );
}

// Rendimiento real: qué tan rápido se siente ALETHEIA para las personas, medido en sus
// navegadores. Primero la respuesta por tipo de pantalla con las tres métricas que Google usa
// para valorar un sitio; después el detalle por versión, para quien quiera investigar.
export function PlatformVitalsPage() {
  const me = useOutletContext<Me>();
  const [days, setDays] = useState<(typeof WINDOWS)[number]>("14");
  const vitals = useQuery({
    ...platformWebVitalsOptions({ query: { days: Number(days) } }),
    enabled: me.platform_admin,
  });
  const rows = vitals.data?.rows ?? [];
  const versions = [...new Set(rows.map((row) => row.version))].sort(
    compareVersions,
  );
  const latest = versions.at(-1);
  const previousVersion = versions.at(-2);
  const find = (
    version: string | undefined,
    device: VitalSummaryRow["device"],
    metric: VitalSummaryRow["metric"],
  ) =>
    rows.find(
      (row) =>
        row.version === version &&
        row.device === device &&
        row.metric === metric,
    );

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Rendimiento real")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Rendimiento real"
        description="Qué tan rápido se siente ALETHEIA en los navegadores de las personas que aceptaron la medición. Cada medida llega sin cuenta, IP ni navegador, y se borra a los 90 días."
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <>
          <SegmentedControl
            label="Periodo"
            value={days}
            onChange={setDays}
            options={WINDOWS.map((value) => ({
              value,
              label: `${value} días`,
            }))}
          />
          {vitals.isPending && <p role="status">Cargando las mediciones</p>}
          {vitals.isError && (
            <Notice tone="error">No pudimos cargar las mediciones.</Notice>
          )}
          {vitals.data && rows.length === 0 && (
            <p className={styles.empty}>
              Todavía no hay medidas en este periodo. Aparecen cuando alguien
              acepta la medición de rendimiento y navega el sitio.
            </p>
          )}
          {vitals.data && latest && (
            <>
              <p className={styles.quiet}>
                {vitals.data.total_samples.toLocaleString("es-CO")} medidas en
                los últimos {vitals.data.days} días. Las cifras son de la
                versión {latest}, la más reciente con datos; cada una es el
                valor que no supera el 75 % de las visitas, como lo valora
                Google.
              </p>
              {(["movil", "escritorio"] as const).map((device) => {
                const cards = KEY_METRICS.map((metric) => ({
                  row: find(latest, device, metric),
                  previous: find(previousVersion, device, metric),
                })).filter((card) => card.row !== undefined);
                if (cards.length === 0) return null;
                return (
                  <Panel key={device} title={DEVICE_LABELS[device]}>
                    <div className={styles.vitalGrid}>
                      {cards.map(({ row, previous }) => (
                        <MetricCard
                          key={row!.metric}
                          row={row!}
                          previous={previous}
                        />
                      ))}
                    </div>
                    <dl className={styles.facts}>
                      {SECONDARY_METRICS.map((metric) => {
                        const row = find(latest, device, metric);
                        return row ? (
                          <div key={metric}>
                            <dt>{METRIC_INFO[metric].question}</dt>
                            <dd>{formatVital(metric, row.p75)}</dd>
                          </div>
                        ) : null;
                      })}
                    </dl>
                  </Panel>
                );
              })}
              <Panel title="Detalle por versión" density="compact">
                <details className={styles.vitalDetails}>
                  <summary>Ver todas las medidas</summary>
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
                            Percentil 75
                          </th>
                          <th scope="col" role="columnheader">
                            Visitas buenas
                          </th>
                        </tr>
                      </thead>
                      <tbody role="rowgroup">
                        {[...rows]
                          .sort(
                            (a, b) =>
                              compareVersions(b.version, a.version) ||
                              a.device.localeCompare(b.device) ||
                              a.metric.localeCompare(b.metric),
                          )
                          .map((row) => (
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
                                {METRIC_INFO[row.metric].name}
                              </td>
                              <td
                                role="cell"
                                data-label="Medidas"
                                className={styles.number}
                              >
                                {row.samples.toLocaleString("es-CO")}
                              </td>
                              <td
                                role="cell"
                                data-label="Percentil 75"
                                className={styles.number}
                              >
                                {formatVital(row.metric, row.p75)}
                              </td>
                              <td
                                role="cell"
                                data-label="Visitas buenas"
                                className={styles.number}
                              >
                                {Math.round(row.good_share * 100)} %
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}
