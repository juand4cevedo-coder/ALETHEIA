// Datos del sitio que se repiten en varias páginas: se cambian aquí y en ningún otro lugar.
export const SITE_NAME = "ALETHEIA";
/** Nombre junto al logo, en la tipografía editorial de la marca. En los textos
 * corrientes la marca se escribe SITE_NAME. */
export const WORDMARK = "Aletheia";
export const SITE_URL = "https://aletheia.sbs";
export const CONTACT_EMAIL = "contacto@aletheia.sbs";
/** Días de la prueba gratuita que anuncian los botones y avisos fijos. Debe coincidir con el
 * plan de prueba del catálogo; donde el catálogo ya cargó, la cifra sale de él. */
export const TRIAL_DAYS = 14;
/** La acción principal del sitio público: el encabezado, la portada, el cierre y precios. */
export const SIGN_UP_LABEL = `Probar ${TRIAL_DAYS} días gratis`;
/** La línea que acompaña a esa acción. */
export const SIGN_UP_NOTE = "Sin tarjeta de crédito. Cancele cuando quiera.";

/** Título de la pestaña: la marca, una barra vertical y el nombre de la pantalla
 * («ALETHEIA | Casos»). Es la única convención; ningún título se arma a mano. */
export function pageTitle(name: string): string {
  return `${SITE_NAME} | ${name}`;
}
