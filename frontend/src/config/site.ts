// Datos del sitio que se repiten en varias páginas: se cambian aquí y en ningún otro lugar.
export const SITE_NAME = "ALETHEIA";
/** Nombre junto al logo, en Geist 600 (especificación de identidad, sección 2). En los textos
 * corrientes la marca se escribe SITE_NAME. */
export const WORDMARK = "Aletheia";
export const SITE_URL = "https://aletheia.sbs";
export const CONTACT_EMAIL = "contacto@aletheia.sbs";

/** Título de la pestaña: el nombre de la pantalla, una barra vertical y la marca
 * («Casos | ALETHEIA»). Es la única convención; ningún título se arma a mano. */
export function pageTitle(name: string): string {
  return `${name} | ${SITE_NAME}`;
}
