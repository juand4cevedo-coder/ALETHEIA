// Datos del sitio que se repiten en varias páginas: se cambian aquí y en ningún otro lugar.
export const SITE_NAME = "ALETHEIA";
/** Nombre junto al logo, en la tipografía editorial de la marca. En los textos
 * corrientes la marca se escribe SITE_NAME. */
export const WORDMARK = "Aletheia";
export const SITE_URL = "https://aletheia.sbs";
export const CONTACT_EMAIL = "contacto@aletheia.sbs";
/** La acción principal del sitio público. Dice lo mismo que el enlace de la pantalla de
 * ingreso. */
export const SIGN_UP_LABEL = "Crear una cuenta";

/** Título de la pestaña: la marca, una barra vertical y el nombre de la pantalla
 * («ALETHEIA | Casos»). Es la única convención; ningún título se arma a mano. */
export function pageTitle(name: string): string {
  return `${SITE_NAME} | ${name}`;
}
