import {
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  useId,
} from "react";

import styles from "./Select.module.css";
import { ChevronAbajoIcon } from "./icons.tsx";

type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "id" | "multiple"
> & {
  /** Rótulo del selector; siempre arriba, porque siempre hay una opción elegida. */
  label: string;
  options: readonly { value: string; label: string }[];
  error?: string;
  ref?: Ref<HTMLSelectElement>;
  /** Ayuda bajo el selector, como lo que permite la opción elegida. */
  children?: ReactNode;
  /** Identificador de esa ayuda, para leerla junto con el selector. */
  describedBy?: string;
};

// Selector (CMP-UI-003): un select nativo con la cápsula de vidrio de los campos (CMP-UI-018).
// El nativo da gratis el teclado, el lector de pantalla y la lista del sistema en el celular;
// sirve para pocas opciones fijas, como el rol de una invitación.
export function Select({
  label,
  options,
  error,
  ref,
  children,
  describedBy: extraDescription,
  ...selectProps
}: SelectProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [extraDescription, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <div className={styles.capsule} data-invalid={error ? "true" : undefined}>
        <select
          {...selectProps}
          ref={ref}
          id={id}
          className={styles.select}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <ChevronAbajoIcon
          className={styles.chevron}
          size={18}
          aria-hidden="true"
        />
      </div>
      {children}
      {error && (
        <span id={errorId} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
