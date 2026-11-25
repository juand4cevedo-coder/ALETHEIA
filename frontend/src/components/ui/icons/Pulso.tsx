// Ícono propio: ver crearPropio en fabrica.tsx.
import { crearPropio } from "./fabrica.tsx";

/** Operación: el trazo de un pulso sobre una línea base. */
export const PulsoIcon = /* @__PURE__ */ crearPropio(
  "PulsoIcon",
  <>
    <path d="M2.75 12h4l2.5-6.5 5 13 2.5-6.5h4.5" />
  </>,
);
