import { Eye, EyeOff } from "lucide-react";
import {
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useId,
  useState,
} from "react";

import styles from "./Blank.module.css";

type BlankProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "id" | "type"
> & {
  /** Rótulo impreso bajo la línea, como en un formulario de papel. */
  label: string;
  type?: "text" | "email" | "password";
  error?: string;
  ref?: Ref<HTMLInputElement>;
  /** Ayuda dinámica bajo el rótulo, como el medidor de la contraseña. */
  children?: ReactNode;
  /** Identificador de esa ayuda, para leerla junto con el campo. */
  describedBy?: string;
};

// Espacio en blanco de un acta (CMP-UI-002 en las pantallas de acceso): una línea donde se
// escribe y, debajo, su rótulo visible. El error y la ayuda quedan asociados al campo.
export function Blank({
  label,
  type = "text",
  error,
  ref,
  children,
  describedBy: extraDescription,
  ...inputProps
}: BlankProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [extraDescription, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <span className={styles.blank}>
      <span className={styles.line}>
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
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        )}
      </span>
      <label htmlFor={id} className={styles.caption}>
        {label}
      </label>
      {children}
      {error && (
        <span id={errorId} className={styles.error}>
          {error}
        </span>
      )}
    </span>
  );
}
