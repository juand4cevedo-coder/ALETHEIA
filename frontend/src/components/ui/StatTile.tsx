import type { ReactNode } from "react";

import styles from "./StatTile.module.css";

type StatTileProps = {
  label: string;
  /** El número ya formateado, o un estado ("Cargando", "No disponible"). */
  value: ReactNode;
  /** Una nota corta bajo el número: de dónde sale el dato o qué cambió. */
  note?: ReactNode;
};

// Una cifra del trabajo real, no un adorno: mismo tratamiento tipográfico en todo el espacio de
// trabajo (especificación de identidad, sección 6).
export function StatTile({ label, value, note }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <p className={styles.label}>{label}</p>
      <strong className={styles.value}>{value}</strong>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
