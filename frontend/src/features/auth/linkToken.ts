// Los enlaces de los correos traen el token en el fragmento (#t=…): el navegador nunca lo
// envía al servidor, así que no queda en los registros de Caddy ni en la cabecera Referer.
const TOKEN_KEY = "t";

/** El token del fragmento de la dirección, o null si no viene. */
export function tokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get(TOKEN_KEY);
  return token && token.length > 0 ? token : null;
}
