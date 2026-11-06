import { QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  type InitialEntry,
  type RouteObject,
  RouterProvider,
} from "react-router";

import { createQueryClient } from "../api/queryClient.ts";
import { routes } from "../routes/router.tsx";

// React Router guarda en cada ruta lo que ya descargó. Cada prueba recibe su propia copia de
// las rutas para empezar como un navegador recién abierto.
function freshRoutes(source: RouteObject[]): RouteObject[] {
  return source.map((route) => ({
    ...route,
    lazy:
      route.lazy && typeof route.lazy === "object"
        ? { ...route.lazy }
        : route.lazy,
    children: route.children && freshRoutes(route.children),
  })) as RouteObject[];
}

/** Monta el sitio completo en la ruta indicada, con las mismas rutas que producción, y espera
 * a que lleguen las pantallas que se descargan aparte. La ruta puede traer estado de navegación,
 * como la pantalla a la que volver después de ingresar. */
export async function renderRoute(path: InitialEntry) {
  // Sin reintentos: una prueba de error ve el fallo de inmediato.
  const queryClient = createQueryClient({ queries: { retry: false } });
  const router = createMemoryRouter(freshRoutes(routes), {
    initialEntries: [path],
  });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await waitFor(() => {
    if (
      !router.state.initialized ||
      rendered.container.querySelector("[data-route-loading]")
    ) {
      throw new Error("La pantalla todavía se está descargando");
    }
  });
  return { router, ...rendered };
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
