// Ícono propio: ver crearPropio en fabrica.tsx.
import { crearPropio } from "./fabrica.tsx";

/** Menú lateral: un marco con su columna izquierda marcada. */
export const PanelLateralIcon = /* @__PURE__ */ crearPropio(
  "PanelLateralIcon",
  <>
    <path
      fill="currentColor"
      fillOpacity="0.2"
      d="M5 4.25h4v15.5H5a2 2 0 0 1-2-2V6.25a2 2 0 0 1 2-2z"
    />
    <rect x="3" y="4.25" width="18" height="15.5" rx="2" />
    <path d="M9 4.25v15.5" />
  </>,
);
