import styles from "./Logotipo.module.css";

// Trazos del logotipo ya calculados (src/brand/geometria.ts, logotipo()). Van escritos aquí para
// que el encabezado no cargue toda la geometría de la marca; Logotipo.test.tsx comprueba que
// coinciden con la geometría.
export const TRAZOS =
  "M0 20L7.75 0L15.5 20M21.5 0V20H32M50.1 0H39.6V20H50.1M39.6 10H48.6M56.7 0H69.7M63.2 0V20M76.3 0V20M89.3 0V20M76.3 10H89.3M107 0H96.5V20H107M96.5 10H105.5M114.2 0V20M120.4 20L128.15 0L135.9 20";
export const ANCHO = 135.9;
const d = TRAZOS;
const ancho = ANCHO;
const GROSOR = 3.1;

/** El logotipo de ALETHEIA dibujado trazo por trazo, en el color del texto que lo rodea. Es
 * decorativo: el enlace o el encabezado que lo contiene lleva el nombre accesible. */
export function Logotipo({ alto = 15 }: { alto?: number }) {
  const m = GROSOR;
  return (
    <svg
      className={styles.logotipo}
      viewBox={`${-m} ${-m} ${ancho + 2 * m} ${20 + 2 * m}`}
      height={alto}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={GROSOR}
        strokeLinejoin="miter"
        strokeMiterlimit={4}
        strokeLinecap="square"
      />
    </svg>
  );
}
