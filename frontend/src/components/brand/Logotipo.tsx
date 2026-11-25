import { logotipo } from "../../brand/geometria.ts";
import styles from "./Logotipo.module.css";

const { d, ancho } = logotipo();
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
