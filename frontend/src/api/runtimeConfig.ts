import type { CreateClientConfig } from "./generated/client.gen.ts";

// Configuración con la que nace el cliente generado (pnpm api:generate la enlaza). Toda petición
// lleva el encabezado propio de la interfaz: la API rechaza con 403 cualquier petición que
// cambie algo sin él (protección contra CSRF, ADR-028). El navegador envía las cookies de
// sesión por su cuenta, porque la interfaz y la API comparten origen.
export const SAME_ORIGIN_HEADER = "X-Aletheia-Request";

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  headers: { ...config?.headers, [SAME_ORIGIN_HEADER]: "1" },
});
