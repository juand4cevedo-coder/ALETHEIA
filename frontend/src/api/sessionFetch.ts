import { SAME_ORIGIN_HEADER } from "./sameOrigin.ts";

// Renovación silenciosa de la sesión (HU-009, API-008). El token de acceso dura 10 minutos;
// cuando una petición responde 401, se pide un par nuevo a /auth/refresh y la petición se
// repite una sola vez, sin que la persona note nada. Si la renovación también falla, la
// sesión terminó de verdad y el 401 original sigue su camino: el espacio de trabajo lleva a
// ingresar.
//
// Cada renovación gasta el token de renovación, y presentar dos veces el mismo cierra la
// sesión entera (CA-HU-009-02). Por eso nunca hay dos renovaciones en vuelo: en una pestaña
// se comparte la misma promesa, y entre pestañas el navegador las pone en fila con un candado
// (Web Locks). Las cookies son de todas las pestañas, así que la segunda en renovar ya envía
// el token que dejó la primera.

const API_PREFIX = "/api/v1";
const REFRESH_PATH = `${API_PREFIX}/auth/refresh`;
const RENEWAL_LOCK = "aletheia:renovar-sesion";

// Bajo /auth solo el cierre de sesión necesita una sesión viva. Las demás rutas responden 401
// por sus propias razones (una contraseña equivocada, por ejemplo) y renovar no las arregla.
const AUTH_PREFIX = `${API_PREFIX}/auth/`;
const AUTH_ROUTES_WITH_SESSION = new Set([
  `${API_PREFIX}/auth/logout`,
  `${API_PREFIX}/auth/logout-all`,
]);

/** Si un 401 de esta ruta se puede resolver renovando la sesión. */
export function renewsSession(url: string): boolean {
  const { pathname } = new URL(url, window.location.origin);
  if (!pathname.startsWith(API_PREFIX)) return false;
  if (!pathname.startsWith(AUTH_PREFIX)) return true;
  return AUTH_ROUTES_WITH_SESSION.has(pathname);
}

let renewal: Promise<boolean> | null = null;

/** Pide un par nuevo de cookies; true si la sesión sigue viva. Las llamadas simultáneas de la
 * pestaña comparten la misma renovación. */
export function renewSession(): Promise<boolean> {
  renewal ??= queued(requestRenewal).finally(() => {
    renewal = null;
  });
  return renewal;
}

async function requestRenewal(): Promise<boolean> {
  try {
    const response = await globalThis.fetch(
      new Request(new URL(REFRESH_PATH, window.location.origin), {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        // La API rechaza cualquier petición que cambie algo sin este encabezado (ADR-028).
        headers: { [SAME_ORIGIN_HEADER]: "1" },
      }),
    );
    return response.ok;
  } catch {
    // Sin red no hay renovación; la petición original conserva su 401.
    return false;
  }
}

function queued(task: () => Promise<boolean>): Promise<boolean> {
  // Los navegadores actuales tienen Web Locks; sin ellos, la promesa compartida basta para la
  // pestaña.
  const locks = globalThis.navigator?.locks;
  if (!locks) return task();
  return locks.request(RENEWAL_LOCK, task);
}

/** fetch del cliente generado: igual al del navegador, pero renueva la sesión ante un 401 y
 * repite la petición una vez. */
export async function sessionFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init);
  if (!renewsSession(request.url)) return globalThis.fetch(request);
  // El cuerpo de una petición solo se lee una vez: la copia es para el reintento.
  const retry = request.clone();
  const response = await globalThis.fetch(request);
  if (response.status !== 401) return response;
  if (!(await renewSession())) return response;
  return globalThis.fetch(retry);
}
