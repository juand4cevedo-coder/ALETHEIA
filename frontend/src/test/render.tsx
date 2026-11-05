import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import {
  createMemoryRouter,
  type InitialEntry,
  RouterProvider,
} from "react-router";

import { routes } from "../routes/router.tsx";

/** Monta el sitio completo en la ruta indicada, con las mismas rutas que producción. La ruta
 * puede traer estado de navegación, como la pantalla a la que volver después de ingresar. */
export function renderRoute(path: InitialEntry) {
  // Sin reintentos: una prueba de error ve el fallo de inmediato.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return {
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

/** Respuesta JSON como la que entrega la API. */
export function jsonResponse(body: unknown, status = 200): Response {
  const contentType =
    status >= 400 ? "application/problem+json" : "application/json";
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}
