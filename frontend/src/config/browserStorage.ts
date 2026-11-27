// Todo lo que el sitio guarda en el almacenamiento local del navegador. La política de cookies
// explica cada clave (features/legal/browserStorageNotice.ts) y el tipo obliga a que ninguna
// quede sin explicar. Ninguno de estos datos sale del navegador.

// Las dos primeras claves también se escriben en sus módulos (cookieConsent.ts y
// sessionHint.ts), que la portada carga sin este archivo; una prueba exige que coincidan.
export const BROWSER_STORAGE = {
  cookieChoice: { key: "aletheia:cookies" },
  sessionHint: { key: "aletheia:sesion" },
  theme: { key: "aletheia:tema" },
  navigation: { key: "aletheia:menu" },
  dismissedNotices: { key: "aletheia:avisos" },
} as const;

export type BrowserStorageName = keyof typeof BROWSER_STORAGE;

/** Lee una clave sin fallar si el navegador bloquea el almacenamiento. */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Guarda una clave; si el navegador lo impide, la preferencia dura solo esta visita. */
export function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento la preferencia vive en memoria hasta cerrar la pestaña.
  }
}
