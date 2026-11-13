import type { ButtonHTMLAttributes } from "react";

import styles from "./Button.module.css";
import { buttonClassName, type ButtonStyleOptions } from "./buttonStyles.ts";
import { CargandoIcon } from "./icons.tsx";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> &
  ButtonStyleOptions & {
    /** Ocupa todo el ancho de su contenedor, como la acción principal de un formulario. */
    block?: boolean;
    /** La acción está en curso: el botón no responde y muestra que trabaja. */
    busy?: boolean;
  };

// Botón de acción (CMP-UI-001). Para ir a otra página se usa ButtonLink.
export function Button({
  variant,
  size,
  block = false,
  busy = false,
  type = "button",
  children,
  disabled,
  ...buttonProps
}: ButtonProps) {
  const className = buttonClassName({ variant, size });
  return (
    <button
      {...buttonProps}
      // Sin type explícito, un botón dentro de un formulario lo enviaría.
      type={type}
      className={block ? `${className} ${styles.block}` : className}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && (
        <CargandoIcon className={styles.spinner} size={16} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
