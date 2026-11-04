import {
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useId,
} from "react";

import styles from "./Field.module.css";

type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "id" | "type"
> & {
  children: ReactNode;
  error?: string;
  ref?: Ref<HTMLInputElement>;
};

// Casilla de consentimiento (CMP-UI-004): el texto de la etiqueta puede llevar enlaces, y el
// error queda asociado a la casilla.
export function Checkbox({
  children,
  error,
  ref,
  ...inputProps
}: CheckboxProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={styles.check}>
      <input
        {...inputProps}
        ref={ref}
        id={id}
        type="checkbox"
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      />
      <label htmlFor={id}>{children}</label>
      {error && (
        <p id={errorId} className={`${styles.error} ${styles.checkError}`}>
          {error}
        </p>
      )}
    </div>
  );
}
