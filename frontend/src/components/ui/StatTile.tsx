import type { ReactNode } from "react";

import { IconTile } from "./IconTile.tsx";
import type { IconComponent } from "./icons.tsx";
import styles from "./StatTile.module.css";

type StatTileProps = {
  label: string;
  /** El número ya formateado, o un estado ("Cargando", "No disponible"). */
  value: ReactNode;
  /** Una nota corta bajo el número: de dónde sale el dato o qué cambió. */
  note?: ReactNode;
  /** Ícono del dato: ayuda a reconocer la tarjeta de un vistazo. */
  icon?: IconComponent;
};

// Una cifra del trabajo real, no un adorno: mismo tratamiento tipográfico en todo el espacio de
// trabajo (especificación de identidad, sección 6).
export function StatTile({ label, value, note, icon }: StatTileProps) {
  return (
    <div className={styles.tile}>
      {icon && (
        <span className={styles.icon}>
          <IconTile icon={icon} />
        </span>
      )}
      <p className={styles.label}>{label}</p>
      <strong className={styles.value}>{value}</strong>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
