import { Shield } from "lucide-react";

import type { CaseTotalsOut } from "../../api/generated";
import styles from "./CustodyStrip.module.css";

const NUMBER = new Intl.NumberFormat("es-CO");

// Franja de la custodia (maqueta 01): responde de un vistazo si las cadenas siguen íntegras y
// cuándo se comprobó, y cuánto hay preservado. Hasta que exista el verificador independiente
// (HU-024) dice «Sin verificar» en gris: nunca un verde que el sistema no se haya ganado.
export function CustodyStrip({ totals }: { totals: CaseTotalsOut }) {
  const pending = totals.pending_stamps > 0;
  return (
    <section className={styles.strip} aria-label="Estado de la custodia">
      <div className={styles.integrity}>
        <span className={styles.ring} aria-hidden="true">
          <Shield size={20} />
        </span>
        <div>
          <p className={styles.label}>Integridad de las cadenas</p>
          <p className={styles.state}>Sin verificar</p>
          <p className={styles.note}>
            Aún no hay una verificación independiente de ninguna cadena.
          </p>
        </div>
      </div>
      <dl className={styles.figures}>
        <div className={styles.figure}>
          <dt>Evidencias preservadas</dt>
          <dd>
            {NUMBER.format(totals.evidences)}
            <span className={styles.unit}>
              {totals.evidences === 1 ? "archivo" : "archivos"}
            </span>
          </dd>
        </div>
        <div className={styles.figure} data-pending={pending || undefined}>
          <dt>Sellos de tiempo pendientes</dt>
          <dd>
            {NUMBER.format(totals.pending_stamps)}
            {pending && <span className={styles.unit}>en curso</span>}
          </dd>
        </div>
        <div className={styles.figure}>
          <dt>Eventos de custodia</dt>
          <dd>{NUMBER.format(totals.custody_events)}</dd>
        </div>
      </dl>
    </section>
  );
}
