// Ícono propio: ver crearPropio en fabrica.tsx.
import { crearPropio } from "./fabrica.tsx";

/** Modo claro: un disco con ocho rayos cortos. */
export const SolIcon = /* @__PURE__ */ crearPropio(
  "SolIcon",
  <>
    <circle fill="currentColor" fillOpacity="0.2" cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.75v1.5M12 19.75v1.5M2.75 12h1.5M19.75 12h1.5M5.46 5.46l1.06 1.06M17.48 17.48l1.06 1.06M5.46 18.54l1.06-1.06M17.48 6.52l1.06-1.06" />
  </>,
);
