import { lazy } from "react";

// El panel solo aparece en la primera visita o cuando se abre desde el pie: se descarga aparte
// para no sumar a la carga inicial de la portada.
export const LazyCookiePanel = lazy(() =>
  import("./CookiePanel.tsx").then((module) => ({
    default: module.CookiePanel,
  })),
);
