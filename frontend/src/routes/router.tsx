import { createBrowserRouter, type RouteObject } from "react-router";

import { ROUTES } from "../config/routes.ts";
import { AppLayout } from "../layouts/AppLayout.tsx";
import { AuthLayout, type AuthSwitch } from "../layouts/AuthLayout.tsx";
import { PublicLayout } from "../layouts/PublicLayout.tsx";
import { HomePage } from "../pages/HomePage.tsx";
import { LegalPage } from "../pages/LegalPage.tsx";
import { NotFoundPage } from "../pages/NotFoundPage.tsx";
import { PricingPage } from "../pages/PricingPage.tsx";
import { SignInPage } from "../pages/SignInPage.tsx";
import { SignUpPage } from "../pages/SignUpPage.tsx";
import { VerifyEmailPage } from "../pages/VerifyEmailPage.tsx";
import { WorkspacePage } from "../pages/WorkspacePage.tsx";

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
  {
    // Pantallas de acceso, con su propio marco (UI-006 a UI-011).
    element: <AuthLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        path: ROUTES.signIn.slice(1),
        element: <SignInPage />,
        handle: {
          authSwitch: {
            question: "¿Todavía no tiene cuenta?",
            label: "Crear cuenta gratis",
            to: ROUTES.signUp,
          } satisfies AuthSwitch,
        },
      },
      {
        path: ROUTES.signUp.slice(1),
        element: <SignUpPage />,
        handle: {
          authSwitch: {
            question: "¿Ya tiene cuenta?",
            label: "Volver a ingresar",
            to: ROUTES.signIn,
          } satisfies AuthSwitch,
        },
      },
      {
        path: ROUTES.verifyEmail.slice(1),
        element: <VerifyEmailPage />,
        handle: {
          authSwitch: {
            question: "¿Ya verificó su correo?",
            label: "Volver a ingresar",
            to: ROUTES.signIn,
          } satisfies AuthSwitch,
        },
      },
    ],
  },
  {
    // Espacio de trabajo: exige sesión. El marco consulta /api/v1/me antes de mostrar nada.
    path: ROUTES.app.slice(1),
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [{ index: true, element: <WorkspacePage /> }],
  },
];

export const router = createBrowserRouter(routes);
