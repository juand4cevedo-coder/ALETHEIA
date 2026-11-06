import type { CreateClientConfig } from "./generated/client.gen.ts";
import { SAME_ORIGIN_HEADER } from "./sameOrigin.ts";
import { sessionFetch } from "./sessionFetch.ts";

export { SAME_ORIGIN_HEADER };

// Configuración con la que nace el cliente generado (pnpm api:generate la enlaza). Toda petición
// lleva el encabezado propio de la interfaz, y un 401 renueva la sesión y repite la petición una
// vez (sessionFetch.ts, HU-009). El navegador envía las cookies de sesión por su cuenta, porque
// la interfaz y la API comparten origen.
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  fetch: sessionFetch,
  headers: { ...config?.headers, [SAME_ORIGIN_HEADER]: "1" },
});
