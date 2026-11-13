import { Hash } from "../../components/ui/Hash.tsx";
import styles from "./StampCard.module.css";
import { SelloIcon } from "../../components/ui/icons.tsx";

// Huella ilustrativa para explicar los campos de un sello; no es una certificación emitida.
const STAMPED_HASH =
  "52a910d44b570bc5cd4d35e1c7420d0d05c2920518d70b61b6f04595b5b9a6f5";

/** Los campos que trae un sello de tiempo RFC 3161, como los muestra la aplicación. */
export function StampCard() {
  return (
    <div className={styles.card}>
      <p className={styles.header}>
        <SelloIcon size={16} aria-hidden="true" />
        Ejemplo de sello de tiempo
      </p>

      <dl className={styles.fields}>
        <div className={styles.field}>
          <dt>Hora</dt>
          <dd>15 de octubre de 2026, 10:39:07 a. m. (hora de Colombia)</dd>
        </div>
        <div className={styles.field}>
          <dt>Huella sellada</dt>
          <dd>
            <Hash value={STAMPED_HASH} variant="short" copyable={false} />
          </dd>
        </div>
        <div className={styles.field}>
          <dt>Norma</dt>
          <dd>RFC 3161</dd>
        </div>
        <div className={styles.field}>
          <dt>Autoridad</dt>
          <dd>Autoridad de sellado externa</dd>
        </div>
      </dl>

      <p className={styles.note}>
        El sello demuestra que la huella del archivo existía en esa fecha y a
        esa hora.
      </p>
    </div>
  );
}
