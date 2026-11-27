import { useCallback, useState } from "react";

import {
  BROWSER_STORAGE,
  readStored,
  writeStored,
} from "../../config/browserStorage.ts";

// Avisos informativos que la persona cerró. Se guarda solo el nombre de cada aviso, en una lista
// corta: los más viejos salen primero para que la clave no crezca sin límite.
const KEY = BROWSER_STORAGE.dismissedNotices.key;
const MAX = 50;

function readAll(): string[] {
  const raw = readStored(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function isNoticeDismissed(id: string): boolean {
  return readAll().includes(id);
}

export function dismissNotice(id: string): void {
  const next = [...readAll().filter((item) => item !== id), id].slice(-MAX);
  writeStored(KEY, JSON.stringify(next));
}

/** Si el aviso sigue visible y cómo cerrarlo. Sin id, el aviso no se puede cerrar. */
export function useDismissible(id: string | undefined): {
  visible: boolean;
  dismiss: () => void;
} {
  const [dismissed, setDismissed] = useState(() =>
    id ? isNoticeDismissed(id) : false,
  );
  const dismiss = useCallback(() => {
    if (!id) return;
    dismissNotice(id);
    setDismissed(true);
  }, [id]);
  return { visible: !dismissed, dismiss };
}
