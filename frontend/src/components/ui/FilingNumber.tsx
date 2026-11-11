import {
  FILING_PARTS,
  formatFilingNumber,
  splitFilingNumber,
} from "../../features/cases/filingNumber.ts";
import styles from "./FilingNumber.module.css";

type FilingNumberProps = {
  /** Los dígitos del radicado, sin separadores. */
  digits: string;
  /** Despliega las ocho partes con su nombre. */
  breakdown?: boolean;
};

// Radicado en monoespaciada y por bloques; no se traduce porque es un identificador.
export function FilingNumber({ digits, breakdown = false }: FilingNumberProps) {
  if (!breakdown) {
    return (
      <code className={styles.value} translate="no">
        {formatFilingNumber(digits)}
      </code>
    );
  }
  const parts = splitFilingNumber(digits);
  return (
    <dl className={styles.breakdown}>
      {FILING_PARTS.map(({ label, length }, index) => (
        <div key={label} className={styles.part}>
          <dt className={styles.label}>{label}</dt>
          <dd className={styles.digits} translate="no">
            {parts[index] || (
              // Una parte sin escribir muestra sus casillas vacías, como un formulario en papel.
              <>
                <span aria-hidden="true">{"_".repeat(length)}</span>
                <span className="visually-hidden">sin escribir</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
