import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { routes } from "../routes/router.tsx";

/** Monta el sitio completo en la ruta indicada, con las mismas rutas que producción. */
export function renderRoute(path: string) {
  // Sin reintentos: una prueba de error ve el fallo de inmediato.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
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
