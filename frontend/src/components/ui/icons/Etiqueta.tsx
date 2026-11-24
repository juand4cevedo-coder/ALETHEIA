// Ícono propio: ver crearPropio en fabrica.tsx.
import { crearPropio } from "./fabrica.tsx";

/** Planes y precios: una etiqueta con su ojal. */
export const EtiquetaIcon = /* @__PURE__ */ crearPropio(
  "EtiquetaIcon",
  <>
    <path
      fill="currentColor"
      fillOpacity="0.2"
      d="M3.5 4.75v6.4c0 .53.21 1.04.59 1.41l8.35 8.35a2 2 0 0 0 2.83 0l5.4-5.4a2 2 0 0 0 0-2.83L12.32 4.33a2 2 0 0 0-1.41-.58H4.5a1 1 0 0 0-1 1z"
    />
    <path d="M3.5 4.75v6.4c0 .53.21 1.04.59 1.41l8.35 8.35a2 2 0 0 0 2.83 0l5.4-5.4a2 2 0 0 0 0-2.83L12.32 4.33a2 2 0 0 0-1.41-.58H4.5a1 1 0 0 0-1 1z" />
    <circle cx="8" cy="8.5" r="1.25" fill="currentColor" stroke="none" />
  </>,
);
