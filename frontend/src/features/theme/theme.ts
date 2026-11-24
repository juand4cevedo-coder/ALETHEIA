import { useSyncExternalStore } from "react";

import {
  BROWSER_STORAGE,
  readStored,
  writeStored,
} from "../../config/browserStorage.ts";

// Modo de color del sitio. /theme.js lo fija antes de pintar; desde ahí este módulo lo lleva:
// recuerda la elección, sigue al sistema cuando la persona eligió «Sistema» y anima el cambio.

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const KEY = BROWSER_STORAGE.theme.key;
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#131017",
};

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Claro",
  dark: "Oscuro",
  system: "Sistema",
};

const listeners = new Set<() => void>();

function systemQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
}

function readPreference(): ThemePreference {
  const stored = readStored(KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return systemQuery()?.matches ? "dark" : "light";
}

let preference: ThemePreference = readPreference();
let snapshot = { preference, resolved: resolve(preference) };

function paint(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[resolved]);
}

function publish(): void {
  const resolved = resolve(preference);
  if (snapshot.preference !== preference || snapshot.resolved !== resolved) {
    snapshot = { preference, resolved };
  }
  paint(resolved);
  for (const listener of listeners) listener();
}

/** Punto desde el que crece el modo nuevo: el botón que lo pidió. */
export type ThemeOrigin = { x: number; y: number };

/** El centro de un elemento, como origen del cambio de modo. */
export function originOf(element: Element): ThemeOrigin {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * Cambia el modo. Con un origen y donde el navegador lo permite, el modo nuevo se abre como un
 * círculo desde el botón; sin movimiento reducido. Si no, el cambio es inmediato.
 */
export function setThemePreference(
  next: ThemePreference,
  origin?: ThemeOrigin,
): void {
  const before = resolve(preference);
  preference = next;
  writeStored(KEY, next === "system" ? null : next);
  const after = resolve(next);
  const reduced = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (
    before === after ||
    !origin ||
    reduced ||
    typeof document.startViewTransition !== "function"
  ) {
    publish();
    return;
  }
  const root = document.documentElement;
  root.dataset.themeSwitch = "";
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );
  const transition = document.startViewTransition(() => publish());
  void transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: 520,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => undefined);
  void transition.finished.finally(() => {
    delete root.dataset.themeSwitch;
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const query = systemQuery();
  const onSystem = () => {
    if (preference === "system") publish();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return;
    preference = readPreference();
    publish();
  };
  if (typeof query?.addEventListener === "function")
    query.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof query?.removeEventListener === "function")
      query.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

/** La preferencia elegida y el modo que se ve ahora. */
export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
} {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
