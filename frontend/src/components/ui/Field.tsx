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
  /** Rótulo del campo. Se ve siempre: dentro del campo vacío y arriba al escribir. */
  label: string;
  type?: "text" | "email" | "password";
  error?: string;
  ref?: Ref<HTMLInputElement>;
  /** Ayuda dinámica bajo el campo, como el medidor de la contraseña. */
  children?: ReactNode;
  /** Identificador de esa ayuda, para leerla junto con el campo. */
  describedBy?: string;
};

// Campo de las pantallas de acceso (CMP-UI-002): una cápsula de vidrio sobre la escena. El
// rótulo nunca desaparece, a diferencia de un texto de ejemplo: está dentro del campo vacío y
// sube cuando la persona escribe. El error y la ayuda quedan asociados al campo.
export function Field({
  label,
  type = "text",
  error,
  ref,
  children,
  describedBy: extraDescription,
  ...inputProps
}: FieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [extraDescription, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <div className={styles.capsule} data-invalid={error ? "true" : undefined}>
        <input
          {...inputProps}
          ref={ref}
          id={id}
          type={isPassword && revealed ? "text" : type}
          // Un espacio como texto de ejemplo: así :placeholder-shown dice si el campo está
          // vacío y el rótulo sabe cuándo subir, sin repetir el rótulo como ejemplo.
          placeholder=" "
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
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
              <OjoTachadoIcon size={18} aria-hidden="true" />
            ) : (
              <OjoIcon size={18} aria-hidden="true" />
            )}
          </button>
        )}
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
