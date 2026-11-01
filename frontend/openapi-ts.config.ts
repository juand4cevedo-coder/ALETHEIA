import { defineConfig } from "@hey-api/openapi-ts";

// Genera los tipos y el cliente HTTP del frontend desde el contrato que exporta el backend.
// Se ejecuta con `pnpm api:generate`, que después pasa Prettier por la carpeta generada; la CI
// lo repite y falla si el resultado no coincide con lo guardado en el repositorio.
export default defineConfig({
  input: "../backend/openapi.json",
  output: "src/api/generated",
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/typescript",
    "@hey-api/sdk",
    // Opciones de consulta listas para TanStack Query: listPlansOptions(), y así por operación.
    "@tanstack/react-query",
  ],
});
