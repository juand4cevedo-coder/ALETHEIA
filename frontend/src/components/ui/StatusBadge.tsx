import type { ReactNode } from "react";

import styles from "./StatusBadge.module.css";

type StatusBadgeProps = {
  /**
   * ok: lo que el sistema verificó, el único uso del verde. pending: en curso o por sellar.
   * error: no coincide o falló. muted y closed: estados sin alerta, en grafito.
   */
  tone: "ok" | "pending" | "error" | "muted" | "closed";
  children: ReactNode;
};

// Insignia de estado (especificación de identidad, sección 7): punto y texto. El color nunca es
// el único indicador; el texto dice el estado.
export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone}>
      <i className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}
