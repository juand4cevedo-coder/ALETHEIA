import type { ReactNode } from "react";
import { useId } from "react";

import styles from "./Meter.module.css";

type MeterProps = {
  label: string;
  /** De 0 a 100. */
  value: number;
  /** Cómo se lee el valor: «12,5 %», «3 de 5 usuarios». */
  valueText: string;
  /** ok: holgado. warn: cerca del límite. error: lo pasó. */
  tone?: "ok" | "warn" | "error" | "brand";
  note?: ReactNode;
};

// Medidor de una cantidad frente a su límite: almacenamiento, cupo de usuarios, tope de
// facturación. La barra crece al aparecer para que el ojo lea la proporción, y el texto dice
// el número: el color nunca es el único portador.
export function Meter({
  label,
  value,
  valueText,
  tone = "brand",
  note,
}: MeterProps) {
  const id = useId();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={styles.meter} data-tone={tone}>
      <div className={styles.head}>
        <span id={id} className={styles.label}>
          {label}
        </span>
        <span className={styles.value}>{valueText}</span>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-valuetext={valueText}
      >
        <span
          className={styles.fill}
          style={{ transform: `scaleX(${clamped / 100})` }}
        />
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
