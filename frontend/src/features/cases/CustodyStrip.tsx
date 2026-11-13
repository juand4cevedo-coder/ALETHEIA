import type { CaseTotalsOut } from "../../api/generated";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import styles from "./CustodyStrip.module.css";

const NUMBER = new Intl.NumberFormat("es-CO");

// Franja de la custodia (maqueta 01): responde de un vistazo si las cadenas siguen íntegras y
// cuánto hay preservado. Hasta que exista el verificador independiente (HU-024) dice «Sin
// verificar» en gris: nunca un verde que el sistema no se haya ganado. Los casos abiertos y
// cerrados no se repiten aquí: ya los cuentan los segmentos de la lista.
export function CustodyStrip({ totals }: { totals: CaseTotalsOut }) {
  const pending = totals.pending_stamps > 0;
  return (
    <section className={styles.strip} aria-label="Estado de la custodia">
      <dl className={styles.figures}>
        <div className={styles.figure}>
          <dt>Integridad de las cadenas</dt>
          <dd className={styles.state}>
            <StatusBadge tone="muted">Sin verificar</StatusBadge>
            <span className={styles.note}>
              Aún no hay una verificación independiente de ninguna cadena.
            </span>
          </dd>
        </div>
        <div className={styles.figure}>
          <dt>Evidencias preservadas</dt>
          <dd className={styles.value}>{NUMBER.format(totals.evidences)}</dd>
        </div>
        <div className={styles.figure}>
          <dt>Sellos de tiempo pendientes</dt>
          {/* Un sello en curso es un estado de la evidencia: el ámbar lo dice. */}
          <dd className={styles.value} data-pending={pending || undefined}>
            {NUMBER.format(totals.pending_stamps)}
          </dd>
        </div>
        <div className={styles.figure}>
          <dt>Eventos de custodia</dt>
          <dd className={styles.value}>
            {NUMBER.format(totals.custody_events)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
