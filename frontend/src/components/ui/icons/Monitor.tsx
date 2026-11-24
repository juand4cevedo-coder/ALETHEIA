// Ícono propio: ver crearPropio en fabrica.tsx.
import { crearPropio } from "./fabrica.tsx";

/** Modo del equipo: una pantalla con su base. */
export const MonitorIcon = /* @__PURE__ */ crearPropio(
  "MonitorIcon",
  <>
    <rect
      fill="currentColor"
      fillOpacity="0.2"
      x="3"
      y="4.25"
      width="18"
      height="12.5"
      rx="2"
    />
    <rect x="3" y="4.25" width="18" height="12.5" rx="2" />
    <path d="M9 20.25h6M12 16.75v3.5" />
  </>,
);
