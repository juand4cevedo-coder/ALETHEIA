// Elección del visitante sobre las cookies opcionales (RF-004, RN-029). Se guarda en el
// almacenamiento local del navegador y nunca viaja al servidor, como dice la política de cookies.
export const COOKIE_CHOICE_KEY = "aletheia:cookies";

/**
 * Versión del consentimiento. Sube cuando se agrega una categoría o una herramienta opcional:
 * las elecciones guardadas con una versión anterior dejan de valer y el panel vuelve a preguntar.
 */
export const CONSENT_VERSION = 1;

/** Categorías que esperan consentimiento. Hoy ninguna tiene una herramienta activa. */
export type OptionalCookieCategory = "analytics";

export type CookieChoice = {
  version: number;
  /** Momento de la decisión, en UTC (RN-028). */
  decidedAt: string;
  analytics: boolean;
};

// Respaldo para navegadores que bloquean el almacenamiento local: la elección dura mientras la
// pestaña siga abierta, y el panel vuelve a aparecer en la próxima visita.
let memoryChoice: string | null = null;

// La última lectura, para devolver el mismo objeto mientras el valor guardado no cambie.
let cachedRaw: string | null | undefined;
let cachedChoice: CookieChoice | null = null;

const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(COOKIE_CHOICE_KEY);
  } catch {
    return memoryChoice;
  }
}

function isCookieChoice(value: unknown): value is CookieChoice {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === "number" &&
    typeof candidate.decidedAt === "string" &&
    typeof candidate.analytics === "boolean"
  );
}

function parse(raw: string | null): CookieChoice | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isCookieChoice(value) && value.version === CONSENT_VERSION
      ? value
      : null;
  } catch {
    // Un valor dañado o escrito a mano cuenta como si no hubiera elección.
    return null;
  }
}

/** La elección vigente, o null si el visitante todavía no ha decidido. */
export function readCookieChoice(): CookieChoice | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedChoice = parse(raw);
  }
  return cachedChoice;
}

/** Guarda la decisión del visitante y avisa a quienes la están mostrando. */
export function saveCookieChoice({ analytics }: { analytics: boolean }): void {
  const raw = JSON.stringify({
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    analytics,
  } satisfies CookieChoice);
  try {
    window.localStorage.setItem(COOKIE_CHOICE_KEY, raw);
  } catch {
    memoryChoice = raw;
  }
  for (const listener of listeners) listener();
}

/** Suscripción para useSyncExternalStore; también escucha los cambios hechos en otra pestaña. */
export function subscribeToCookieChoice(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === COOKIE_CHOICE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Dice si el visitante aceptó una categoría. Toda herramienta no esencial que se agregue en el
 * futuro se carga solo si esto devuelve true (CA-HU-004-01).
 */
export function hasCookieConsent(category: OptionalCookieCategory): boolean {
  return readCookieChoice()?.[category] === true;
}
