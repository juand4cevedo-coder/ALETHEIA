import { createBrowserRouter, type RouteObject } from "react-router";

import { PublicLayout } from "../layouts/PublicLayout.tsx";
import { HomePage } from "../pages/HomePage.tsx";
import { LegalPage } from "../pages/LegalPage.tsx";
import { NotFoundPage } from "../pages/NotFoundPage.tsx";
import { PricingPage } from "../pages/PricingPage.tsx";

// Rutas del sitio. Caddy entrega index.html para cualquier ruta que no sea un archivo, y
// React Router decide qué página mostrar. Las pruebas montan estas mismas rutas en memoria.
export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "precios", element: <PricingPage /> },
      { path: "legal/:pagina", element: <LegalPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
