import type { VitalSummaryRow } from "../../api/generated";

type Metric = VitalSummaryRow["metric"];

// Cada métrica dicha como la pregunta que responde, con su umbral bueno de Core Web Vitals y el
// cambio mínimo que vale la pena señalar entre versiones (por debajo es ruido de la muestra).
export const METRIC_INFO: Record<
  Metric,
  { question: string; name: string; good: string; noise: number }
> = {
  LCP: {
    question: "¿Cuánto tarda en verse lo principal?",
    name: "Contenido más grande (LCP)",
    good: "2,5 s",
    noise: 100,
  },
  INP: {
    question: "¿Cuánto tarda en responder a un toque?",
    name: "Respuesta a la interacción (INP)",
    good: "200 ms",
    noise: 20,
  },
  CLS: {
    question: "¿Se mueve la página mientras carga?",
    name: "Estabilidad visual (CLS)",
    good: "0,1",
    noise: 0.02,
  },
  FCP: {
    question: "Primer contenido en pantalla",
    name: "Primer contenido (FCP)",
    good: "1,8 s",
    noise: 100,
  },
  TTFB: {
    question: "Respuesta del servidor",
    name: "Tiempo al primer byte (TTFB)",
    good: "0,8 s",
    noise: 50,
  },
};

/** Las tres que Google usa para valorar un sitio; las otras dos ayudan a diagnosticar. */
export const KEY_METRICS: readonly Metric[] = ["LCP", "INP", "CLS"];
export const SECONDARY_METRICS: readonly Metric[] = ["FCP", "TTFB"];

/** CLS no tiene unidad; el resto son milisegundos y desde 1 s se muestran en segundos. */
export function formatVital(metric: Metric, value: number): string {
  if (metric === "CLS")
    return value.toLocaleString("es-CO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    });
  return value >= 1000
    ? `${(value / 1000).toLocaleString("es-CO", { maximumFractionDigits: 2 })} s`
    : `${Math.round(value)} ms`;
}

/** Ordena versiones como 0.9.1 < 0.10.0 < 0.43.0, no como texto. */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0 && !Number.isNaN(diff)) return diff;
  }
  return a.localeCompare(b);
}
