// Pista de sesión para el sitio público (Diseño UX/UI, sección 4.2): con una sesión abierta,
// «Ingresar» cambia a «Ir a mis casos». Las cookies de sesión son HttpOnly y la página no puede
// leerlas, así que se guarda solo un aviso sin datos personales. Si la sesión ya venció, el
// espacio de trabajo lleva a ingresar y borra el aviso. La política de cookies lo explica
// (config/browserStorage.ts reúne todas las claves).
export const SESSION_HINT_KEY = "aletheia:sesion";

export function hasSessionHint(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberSession(): void {
  try {
    window.localStorage.setItem(SESSION_HINT_KEY, "1");
  } catch {
    // Sin almacenamiento el sitio público simplemente muestra «Ingresar».
  }
}

export function forgetSession(): void {
  try {
    window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Nada que borrar.
  }
}
