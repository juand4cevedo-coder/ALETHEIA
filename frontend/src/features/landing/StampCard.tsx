import { BadgeCheck } from "lucide-react";

import { Hash } from "../../components/ui/Hash.tsx";
import styles from "./StampCard.module.css";

// La misma huella de ejemplo que muestra la vista del hero (EvidencePreview): el sello se
// emite sobre ella.
const STAMPED_HASH =
  "52a910d44b570bc5cd4d35e1c7420d0d05c2920518d70b61b6f04595b5b9a6f5";

type StampCardProps = {
  /** "full" en la pieza central; "compact" para superponerla sobre la vista del hero. */
  size?: "full" | "compact";
};

/** Demostración C: los campos que trae un sello de tiempo RFC 3161, con datos ficticios. */
export function StampCard({ size = "full" }: StampCardProps) {
  return (
    <div
      className={`${styles.card} ${size === "compact" ? styles.compact : styles.full}`}
    >
      <div className={styles.header}>
        {/* El sello es solo un motivo: dos anillos alrededor del ícono. */}
        <span className={styles.seal} aria-hidden="true">
          <BadgeCheck aria-hidden="true" />
        </span>
        <span className={styles.fictitious}>Datos ficticios</span>
      </div>

      <dl className={styles.fields}>
        <div className={styles.field}>
          <dt>Hora</dt>
          <dd>15/10/2026, 10:39:07 (hora de Colombia)</dd>
        </div>
        <div className={styles.field}>
          <dt>Huella sellada</dt>
          <dd>
            <Hash value={STAMPED_HASH} variant="short" copyable={false} />
          </dd>
        </div>
        <div className={styles.field}>
          <dt>Política</dt>
          <dd>RFC 3161</dd>
        </div>
        <div className={styles.field}>
          <dt>Autoridad</dt>
          <dd>Autoridad de sellado externa</dd>
        </div>
      </dl>

      {/* Qué prueba el sello, con las palabras de las preguntas frecuentes. En el hero sobra. */}
      {size === "full" && (
        <p className={styles.note}>
          El sello demuestra que la huella del archivo existía en una fecha y
          hora determinadas.
        </p>
      )}
    </div>
  );
}
