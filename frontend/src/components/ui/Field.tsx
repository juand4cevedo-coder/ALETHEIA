import {
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useId,
  useState,
} from "react";

import styles from "./Field.module.css";
import { OjoIcon, OjoTachadoIcon } from "./icons.tsx";

type FieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "id" | "type" | "placeholder"
> & {
  /** Etiqueta del campo, siempre visible encima de él. */
  label: string;
  type?: "text" | "email" | "password";
  /** Ayuda fija bajo el campo. El error la reemplaza mientras exista. */
  help?: string;
  /** Qué pasó y cómo corregirlo. */
  error?: string;
  ref?: Ref<HTMLInputElement>;
  /** Ayuda dinámica bajo el campo, como el medidor de la contraseña o un contador. */
  children?: ReactNode;
  /** Identificador de esa ayuda dinámica, para leerla junto con el campo. */
  describedBy?: string;
};

// Campo de texto (CMP-UI-002, especificación de identidad, sección 7): la etiqueta va encima y
// nunca dentro del campo, la ayuda debajo, y el error ocupa el lugar de la ayuda para decir
// cómo corregir. El lector de pantalla recibe la ayuda o el error junto con el campo.
export function Field({
  label,
  type = "text",
  help,
  error,
  ref,
  children,
  describedBy: extraDescription,
  ...inputProps
}: FieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const helpId = help && !error ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [extraDescription, helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control} data-invalid={error ? "true" : undefined}>
        <input
          {...inputProps}
          ref={ref}
          id={id}
          type={isPassword && revealed ? "text" : type}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.reveal}
            aria-controls={id}
            aria-pressed={revealed}
            aria-label="Mostrar la contraseña"
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? (
              <OjoTachadoIcon size={16} aria-hidden="true" />
            ) : (
              <OjoIcon size={16} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {children}
      {error ? (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      ) : (
        help && (
          <p id={helpId} className={styles.help}>
            {help}
          </p>
        )
      )}
    </div>
  );
}
