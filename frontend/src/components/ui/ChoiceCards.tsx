import { type ReactNode, useId } from "react";

import styles from "./ChoiceCards.module.css";

type Choice<T extends string> = {
  value: T;
  label: ReactNode;
  /** Una línea que explica la opción: el precio, el plazo, lo que implica. */
  description?: ReactNode;
};

// Opciones excluyentes en tarjetas: para elegir entre pocas alternativas que necesitan una
// explicación (mensual o anual, el tipo de solicitud). Son radios nativos, así funcionan con las
// flechas del teclado y el lector de pantalla los anuncia como grupo.
export function ChoiceCards<T extends string>({
  legend,
  value,
  options,
  onChange,
  columns = 1,
}: {
  legend: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
  /** Dos columnas para opciones cortas, como la periodicidad. */
  columns?: 1 | 2;
}) {
  const name = useId();
  return (
    <fieldset className={styles.group} data-columns={columns}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <label key={option.value} className={styles.choice}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span className={styles.text}>
              <span className={styles.label}>{option.label}</span>
              {option.description && (
                <span className={styles.description}>{option.description}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
