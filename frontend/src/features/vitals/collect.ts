// Medición de Core Web Vitals de las visitas reales (ADR-052). Este archivo se descarga aparte y
// solo cuando la persona aceptó la categoría «analítica» del panel de cookies (main.tsx).
//
// Lo que sale de la página es una sola petición al terminar la visita, con la métrica, su valor,
// el grupo de página (nunca la dirección), el tipo de pantalla y de conexión. No hay cookie,
// identificador ni almacenamiento en el navegador, y solo se mide la página con que se cargó
// el sitio: las navegaciones internas no se cuentan.
import { SAME_ORIGIN_HEADER } from "../../api/sameOrigin.ts";
import { LEGAL_PAGES, legalRoute, ROUTES } from "../../config/routes.ts";

export type VitalName = "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
export type PageGroup =
  | "inicio"
  | "precios"
  | "ingreso"
  | "documentacion"
  | "legal"
  | "espacio"
  | "otra";
export type VitalMeasures = Partial<Record<VitalName, number>>;

const ENDPOINT = "/api/v1/web-vitals";
const CONNECTIONS = ["slow-2g", "2g", "3g", "4g"] as const;
const SIGN_IN_ROUTES: readonly string[] = [
  ROUTES.signIn,
  ROUTES.signUp,
  ROUTES.verifyEmail,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
  ROUTES.acceptInvitation,
];
const LEGAL_ROUTES: readonly string[] = LEGAL_PAGES.map((page) =>
  legalRoute(page.slug),
);

/** Grupo de la página: sirve para comparar sin guardar rutas con identificadores de casos. */
export function pageGroup(pathname: string): PageGroup {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === ROUTES.home) return "inicio";
  if (path === ROUTES.pricing) return "precios";
  if (SIGN_IN_ROUTES.includes(path)) return "ingreso";
  if (path === "/docs" || path.startsWith("/docs/")) return "documentacion";
  if (LEGAL_ROUTES.includes(path)) return "legal";
  if (path === ROUTES.app || path.startsWith(`${ROUTES.app}/`))
    return "espacio";
  return "otra";
}

export function deviceClass(viewportWidth: number): "movil" | "escritorio" {
  return viewportWidth < 768 ? "movil" : "escritorio";
}

/**
 * Interaction to Next Paint: la peor interacción, o la 2.ª o 3.ª peor cuando hubo muchas (una
 * por cada 50), igual que el cálculo que publica Google. Sin interacciones no hay medida.
 */
export function interactionToNextPaint(
  durations: Iterable<number>,
): number | undefined {
  const sorted = [...durations].sort((a, b) => b - a);
  if (sorted.length === 0) return undefined;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length / 50))];
}

/** Cumulative Layout Shift: la ventana de saltos más grande (separados por menos de 1 s y de
 * 5 s de largo), sin contar los que siguen a una acción de la persona. */
export class LayoutShiftWindows {
  #windowValue = 0;
  #windowStart = 0;
  #lastShift = 0;
  #max = 0;

  add(shift: { value: number; startTime: number }): void {
    const continues =
      this.#windowValue > 0 &&
      shift.startTime - this.#lastShift < 1000 &&
      shift.startTime - this.#windowStart < 5000;
    if (continues) {
      this.#windowValue += shift.value;
    } else {
      this.#windowValue = shift.value;
      this.#windowStart = shift.startTime;
    }
    this.#lastShift = shift.startTime;
    this.#max = Math.max(this.#max, this.#windowValue);
  }

  get value(): number {
    return this.#max;
  }
}

type ObserverEntry = PerformanceEntry & {
  hadRecentInput?: boolean;
  value?: number;
  interactionId?: number;
  responseStart?: number;
};

function observe(
  type: string,
  onEntries: (entries: ObserverEntry[]) => void,
  options: PerformanceObserverInit = {},
): void {
  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
    new PerformanceObserver((list) =>
      onEntries(list.getEntries() as ObserverEntry[]),
    ).observe({ type, buffered: true, ...options });
  } catch {
    // Un navegador sin esa métrica simplemente no la entrega.
  }
}

function effectiveConnection(): (typeof CONNECTIONS)[number] | undefined {
  const type = (
    navigator as Navigator & { connection?: { effectiveType?: string } }
  ).connection?.effectiveType;
  return CONNECTIONS.find((known) => known === type);
}

/**
 * Empieza a medir esta visita y entrega el resultado una sola vez, al salir de la página.
 * `allowed` se vuelve a preguntar al entregar: quien retire la analítica a mitad de la visita
 * no envía nada.
 */
export function startVitals(allowed: () => boolean): void {
  // Una pestaña abierta en segundo plano o prerenderizada no vive la carga que se quiere medir.
  if (document.visibilityState !== "visible") return;

  const measures: VitalMeasures = {};
  const group = pageGroup(location.pathname);
  const device = deviceClass(window.innerWidth);
  const shifts = new LayoutShiftWindows();
  const interactions = new Map<number, number>();
  let sent = false;

  observe("paint", (entries) => {
    for (const entry of entries)
      if (entry.name === "first-contentful-paint")
        measures.FCP = entry.startTime;
  });
  observe("largest-contentful-paint", (entries) => {
    const last = entries.at(-1);
    if (last) measures.LCP = last.startTime;
  });
  observe("layout-shift", (entries) => {
    for (const entry of entries)
      if (!entry.hadRecentInput && entry.value)
        shifts.add({ value: entry.value, startTime: entry.startTime });
    measures.CLS = shifts.value;
  });
  observe(
    "event",
    (entries) => {
      for (const entry of entries) {
        if (!entry.interactionId) continue;
        interactions.set(
          entry.interactionId,
          Math.max(interactions.get(entry.interactionId) ?? 0, entry.duration),
        );
      }
      const inp = interactionToNextPaint(interactions.values());
      if (inp !== undefined) measures.INP = inp;
    },
    { durationThreshold: 40 } as PerformanceObserverInit,
  );
  observe("navigation", (entries) => {
    const navigation = entries[0];
    if (navigation?.responseStart) measures.TTFB = navigation.responseStart;
  });

  const send = () => {
    if (sent || !allowed()) return;
    const metrics = (Object.keys(measures) as VitalName[]).map((name) => ({
      name,
      value: Math.round(measures[name]! * 1000) / 1000,
    }));
    if (metrics.length === 0) return;
    sent = true;
    const connection = effectiveConnection();
    void fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        [SAME_ORIGIN_HEADER]: "1",
      },
      // Sin cookies ni encabezados de la sesión: la entrega no es de nadie.
      credentials: "omit",
      body: JSON.stringify({
        page: group,
        device,
        ...(connection ? { connection } : {}),
        metrics,
      }),
    }).catch(() => undefined);
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send();
  });
  addEventListener("pagehide", send);
}
