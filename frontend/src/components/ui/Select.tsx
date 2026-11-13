import {
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  useId,
} from "react";

import fieldStyles from "./Field.module.css";
import styles from "./Select.module.css";
import { ChevronAbajoIcon } from "./icons.tsx";

type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "id" | "multiple"
> & {
  /** Etiqueta del selector, encima de él como en los campos de texto. */
  label: string;
  options: readonly { value: string; label: string }[];
  /** Ayuda fija bajo el selector. El error la reemplaza mientras exista. */
  help?: string;
  error?: string;
  ref?: Ref<HTMLSelectElement>;
  /** Ayuda dinámica bajo el selector, como lo que permite la opción elegida. */
  children?: ReactNode;
  /** Identificador de esa ayuda, para leerla junto con el selector. */
  describedBy?: string;
};

// Selector (CMP-UI-003): un select nativo con la misma forma de Field. El nativo da gratis el
// teclado, el lector de pantalla y la lista del sistema en el celular; sirve para pocas opciones
// fijas, como el rol de una invitación.
export function Select({
  label,
  options,
  help,
  error,
  ref,
  children,
  describedBy: extraDescription,
  ...selectProps
}: SelectProps) {
  const id = useId();
  const helpId = help && !error ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [extraDescription, helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={fieldStyles.field}>
      <label htmlFor={id} className={fieldStyles.label}>
        {label}
      </label>
      <div
        className={fieldStyles.control}
        data-invalid={error ? "true" : undefined}
      >
        <select
          {...selectProps}
          ref={ref}
          id={id}
          className={`${fieldStyles.input} ${styles.select}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronAbajoIcon
          className={styles.chevron}
          size={16}
          aria-hidden="true"
        />
      </div>
      {children}
      {error ? (
        <p id={errorId} className={fieldStyles.error}>
          {error}
        </p>
      ) : (
        help && (
          <p id={helpId} className={fieldStyles.help}>
            {help}
          </p>
        )
      )}
    </div>
  );
}
