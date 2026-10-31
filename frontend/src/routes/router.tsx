import { createBrowserRouter } from "react-router";

import { PublicLayout } from "../layouts/PublicLayout.tsx";
import { HomePage } from "../pages/HomePage.tsx";
import { NotFoundPage } from "../pages/NotFoundPage.tsx";
import { PricingPage } from "../pages/PricingPage.tsx";

// Rutas del sitio. Caddy entrega index.html para cualquier ruta que no sea un archivo, y
// React Router decide qué página mostrar.
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "precios", element: <PricingPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
