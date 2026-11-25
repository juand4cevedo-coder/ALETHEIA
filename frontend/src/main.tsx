import "./styles/fonts.css";
import "./styles/global.css";

import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import {
  hasCookieConsent,
  subscribeToCookieChoice,
} from "./features/consent/cookieConsent.ts";
import { hasSessionHint } from "./features/session/sessionHint.ts";
import { prefetchWorkspace } from "./routes/lazyRoutes.ts";
import { router } from "./routes/router.tsx";

// El HTML de cada página pública llega ya dibujado (scripts/prerender.mjs). React lo reemplaza
// cuando la ruta terminó de cargar, para no pasar por la pantalla de espera, y quita del head el
// título, la descripción y la dirección canónica estáticos: la página pone los mismos, y así
// nunca hay dos. No se hidrata: el aviso de cookies y la pista de sesión dependen del
// navegador y el HTML no siempre coincidiría.
// TanStack Query no se monta aquí: lo trae el marco del acceso y del espacio de trabajo
// (routes/QueryRoot.tsx), para que la landing no lo descargue.
function mount() {
  const container = document.getElementById("root")!;
  const prerendered = container.hasChildNodes();
  for (const element of document.head.querySelectorAll("[data-estatica]"))
    element.remove();
  flushSync(() =>
    createRoot(container).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    ),
  );
  // La página ya estaba a la vista: sus animaciones de entrada no se repiten.
  if (prerendered) finishEntranceAnimations(container);
}

function finishEntranceAnimations(container: HTMLElement) {
  for (const animation of document.getAnimations()) {
    const target = (animation.effect as KeyframeEffect | null)?.target;
    if (animation.timeline !== document.timeline) continue;
    if (!(target instanceof Node) || !container.contains(target)) continue;
    try {
      animation.finish();
    } catch {
      // Una animación sin fin no se puede terminar; se deja como está.
    }
  }
}

if (router.state.initialized) mount();
else {
  const unsubscribe = router.subscribe((state) => {
    if (!state.initialized) return;
    unsubscribe();
    mount();
  });
}

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
