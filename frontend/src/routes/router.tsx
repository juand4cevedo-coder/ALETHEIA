import { createBrowserRouter, type RouteObject } from "react-router";

import { ROUTES } from "../config/routes.ts";
import type { AuthSwitch } from "../layouts/AuthLayout.tsx";
import { PublicLayout } from "../layouts/PublicLayout.tsx";
import { HomePage } from "../pages/HomePage.tsx";
import { NotFoundPage } from "../pages/NotFoundPage.tsx";
import {
  loadAcceptInvitationPage,
  loadAccountPage,
  loadAppShell,
  loadAuthLayout,
  loadCasePage,
  loadCasesPage,
  loadForgotPasswordPage,
  loadLegalPage,
  loadMembersPage,
  loadNewCasePage,
  loadPricingPage,
  loadResetPasswordPage,
  loadSignInPage,
  loadSignUpPage,
  loadVerifyEmailPage,
  loadWorkspacePage,
} from "./lazyRoutes.ts";

// Mientras llega el archivo de una pantalla que se abre directamente, la página queda con su
// fondo oscuro; no hay un indicador que parpadee en una espera tan corta.
const loading = <div aria-busy="true" data-route-loading="" />;

// Rutas del sitio. Caddy entrega index.html para cualquier ruta que no sea un archivo, y
// React Router decide qué página mostrar. Las pruebas montan estas mismas rutas en memoria.
// Salvo el inicio, cada pantalla se descarga al abrirla (lazyRoutes.ts).
export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    hydrateFallbackElement: loading,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "precios", lazy: { Component: loadPricingPage } },
      { path: "legal/:pagina", lazy: { Component: loadLegalPage } },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    // Pantallas de acceso, con su propio marco (UI-006 a UI-011).
    lazy: { Component: loadAuthLayout },
    hydrateFallbackElement: loading,
    errorElement: <NotFoundPage />,
    children: [
      {
        path: ROUTES.signIn.slice(1),
        lazy: { Component: loadSignInPage },
        handle: {
          redirectSignedIn: true,
          authSwitch: {
            question: "¿Todavía no tiene cuenta?",
            label: "Crear una cuenta",
            to: ROUTES.signUp,
          } satisfies AuthSwitch,
        },
      },
      {
        path: ROUTES.signUp.slice(1),
        lazy: { Component: loadSignUpPage },
        handle: {
          redirectSignedIn: true,
          authSwitch: {
            question: "¿Ya tiene cuenta?",
            label: "Ingresar",
            to: ROUTES.signIn,
          } satisfies AuthSwitch,
        },
      },
      {
        path: ROUTES.forgotPassword.slice(1),
        lazy: { Component: loadForgotPasswordPage },
        handle: {
          redirectSignedIn: true,
          authSwitch: {
            question: "¿Recordó su contraseña?",
            label: "Volver a ingresar",
            to: ROUTES.signIn,
          } satisfies AuthSwitch,
        },
      },
      {
        path: ROUTES.resetPassword.slice(1),
        lazy: { Component: loadResetPasswordPage },
        handle: {
          authSwitch: {
            question: "¿Recordó su contraseña?",
            label: "Volver a ingresar",
            to: ROUTES.signIn,
          } satisfies AuthSwitch,
        },
      },
      {
        // Se abre desde el correo de invitación: nunca redirige, haya o no sesión.
        path: ROUTES.acceptInvitation.slice(1),
        lazy: { Component: loadAcceptInvitationPage },
      },
      {
        path: ROUTES.verifyEmail.slice(1),
        lazy: { Component: loadVerifyEmailPage },
        handle: {
          authSwitch: {
            question: "¿Ya verificó su correo?",
            label: "Ingresar",
            to: ROUTES.signIn,
          } satisfies AuthSwitch,
        },
      },
    ],
  },
  {
    // Espacio de trabajo: exige sesión. El marco consulta /api/v1/me antes de mostrar nada.
    path: ROUTES.app.slice(1),
    lazy: { Component: loadAppShell },
    hydrateFallbackElement: loading,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, lazy: { Component: loadWorkspacePage } },
      {
        path: ROUTES.account.slice(ROUTES.app.length + 1),
        lazy: { Component: loadAccountPage },
      },
      {
        path: ROUTES.members.slice(ROUTES.app.length + 1),
        lazy: { Component: loadMembersPage },
      },
      {
        path: ROUTES.cases.slice(ROUTES.app.length + 1),
        lazy: { Component: loadCasesPage },
      },
      {
        path: ROUTES.newCase.slice(ROUTES.app.length + 1),
        lazy: { Component: loadNewCasePage },
      },
      {
        // El segmento fijo «nuevo» gana sobre :caseId, así que el orden no importa.
        path: "casos/:caseId",
        lazy: { Component: loadCasePage },
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
