// Ícono propio: ver crearPropio en fabrica.tsx.
import { crearPropio } from "./fabrica.tsx";

/** Modo oscuro: una luna creciente. */
export const LunaIcon = /* @__PURE__ */ crearPropio(
  "LunaIcon",
  <>
    <path
      fill="currentColor"
      fillOpacity="0.2"
      d="M20.25 14.15A8.25 8.25 0 0 1 9.85 3.75a8.25 8.25 0 1 0 10.4 10.4z"
    />
    <path d="M20.25 14.15A8.25 8.25 0 0 1 9.85 3.75a8.25 8.25 0 1 0 10.4 10.4z" />
  </>,
);
