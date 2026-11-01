import { Hash } from "../../components/ui/Hash.tsx";
import styles from "./PreservationDemo.module.css";

// Huella real de un texto de ejemplo, para que la demostración muestre un valor con la forma
// exacta de una SHA-256.
const EXAMPLE_HASH =
  "52a910d44b570bc5cd4d35e1c7420d0d05c2920518d70b61b6f04595b5b9a6f5";

// Demostración del inicio (UI-001): el recorrido de una evidencia en cuatro pasos. Los pasos
// aparecen uno tras otro; con movimiento reducido se muestran completos desde el principio.
export function PreservationDemo() {
  return (
    <figure className={styles.demo}>
      <figcaption className={styles.caption}>
        <span className={styles.case}>Caso 2026-014 · Laboral</span>
        <span className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          Preservada
        </span>
      </figcaption>

      <ol className={styles.steps}>
        <li className={styles.step}>
          <span className={styles.marker} aria-hidden="true">
            1
          </span>
          <div className={styles.body}>
            <p className={styles.label}>Archivo recibido</p>
            <p className={styles.value}>chat_cliente.zip · 2,4 MB</p>
          </div>
        </li>
        <li className={styles.step}>
          <span className={styles.marker} aria-hidden="true">
            2
          </span>
          <div className={styles.body}>
            <p className={styles.label}>Huella SHA-256</p>
            <div className={styles.value}>
              <Hash value={EXAMPLE_HASH} copyable={false} />
            </div>
          </div>
        </li>
        <li className={styles.step}>
          <span className={styles.marker} aria-hidden="true">
            3
          </span>
          <div className={styles.body}>
            <p className={styles.label}>Sello de tiempo</p>
            <p className={styles.value}>
              15/10/2026, 10:39:12, hora de Colombia
            </p>
            <p className={styles.detail}>Emitido por una autoridad externa</p>
          </div>
        </li>
        <li className={styles.step}>
          <span className={styles.marker} aria-hidden="true">
            4
          </span>
          <div className={styles.body}>
            <p className={styles.label}>Cadena de custodia</p>
            <p className={styles.value}>
              Evento 45 · Laura Gómez subió el original
            </p>
          </div>
        </li>
      </ol>

      <p className={styles.note}>Ejemplo con datos ficticios.</p>
    </figure>
  );
}
