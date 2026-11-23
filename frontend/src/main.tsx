import "./styles/fonts.css";
import "./styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import {
  hasCookieConsent,
  subscribeToCookieChoice,
} from "./features/consent/cookieConsent.ts";
import { hasSessionHint } from "./features/session/sessionHint.ts";
import { prefetchWorkspace } from "./routes/lazyRoutes.ts";
import { router } from "./routes/router.tsx";

// TanStack Query no se monta aquí: lo trae el marco del acceso y del espacio de trabajo
// (routes/QueryRoot.tsx), para que la landing no lo descargue.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

// La pista de sesión solo adelanta descargas; la sesión real la decide la API.
if (hasSessionHint() && !location.pathname.startsWith("/app"))
  prefetchWorkspace();

// Core Web Vitals de las visitas reales: solo si la persona aceptó la analítica (ADR-052). El
// código de medición se descarga aparte, y solo entonces.
let vitalsStarted = false;
function startVitalsIfAllowed() {
  if (vitalsStarted || !hasCookieConsent("analytics")) return;
  vitalsStarted = true;
  void import("./features/vitals/collect.ts").then((module) =>
    module.startVitals(() => hasCookieConsent("analytics")),
  );
}
startVitalsIfAllowed();
subscribeToCookieChoice(startVitalsIfAllowed);
