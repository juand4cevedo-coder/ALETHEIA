import { Eye, EyeOff } from "lucide-react";
import {
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useId,
  useState,
} from "react";

import styles from "./Field.module.css";

type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "id" | "type"
> & {
  label: string;
  type?: "text" | "email" | "password";
  hint?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
  /** Ayuda dinámica bajo el campo, como el medidor de la contraseña. */
  children?: ReactNode;
  /** Identificador de esa ayuda, para que el lector de pantalla la lea con el campo. */
  describedBy?: string;
};

// Campo de texto (CMP-UI-002). La etiqueta siempre está visible, la ayuda y el error quedan
// asociados al campo con aria-describedby, y una contraseña se puede mostrar para revisarla.
export function TextField({
  label,
  type = "text",
  hint,
  error,
  ref,
  children,
  describedBy: extraDescription,
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const hintId = hint ? `${id}-ayuda` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [hintId, extraDescription, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      <div className={styles.control}>
        <input
          {...inputProps}
          ref={ref}
          id={id}
          type={isPassword && revealed ? "text" : type}
          className={
            isPassword ? `${styles.input} ${styles.withToggle}` : styles.input
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.toggle}
            aria-controls={id}
            aria-pressed={revealed}
            aria-label="Mostrar la contraseña"
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? (
              <EyeOff size={20} aria-hidden="true" />
            ) : (
              <Eye size={20} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {children}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
