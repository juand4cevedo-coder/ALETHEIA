import { useSyncExternalStore } from "react";

import {
  BROWSER_STORAGE,
  readStored,
  writeStored,
} from "../../config/browserStorage.ts";

// Preferencias del menú lateral: si va compacto (solo íconos) y qué grupos quedaron plegados.
// Viven en el navegador (política de cookies) y se comparten entre pestañas.

export type NavPreferences = {
  compact: boolean;
  folded: readonly string[];
};

const KEY = BROWSER_STORAGE.navigation.key;
const EMPTY: NavPreferences = { compact: false, folded: [] };
const listeners = new Set<() => void>();

function parse(raw: string | null): NavPreferences {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return EMPTY;
    const candidate = value as Record<string, unknown>;
    return {
      compact: candidate.compact === true,
      folded: Array.isArray(candidate.folded)
        ? candidate.folded.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
    };
  } catch {
    return EMPTY;
  }
}

let raw = readStored(KEY);
let snapshot = parse(raw);

function save(next: NavPreferences): void {
  raw = JSON.stringify(next);
  snapshot = next;
  writeStored(KEY, raw);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return;
    raw = readStored(KEY);
    snapshot = parse(raw);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useNavPreferences(): NavPreferences {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

export function setCompact(compact: boolean): void {
  save({ ...snapshot, compact });
}

export function toggleGroup(id: string): void {
  const folded = snapshot.folded.includes(id)
    ? snapshot.folded.filter((item) => item !== id)
    : [...snapshot.folded, id];
  save({ ...snapshot, folded });
}
