import type { ReactNode } from "react";

import styles from "./StatusBadge.module.css";

type StatusBadgeProps = {
  tone: "ok" | "pending" | "muted" | "closed";
  children: ReactNode;
};

// Estado con punto y texto: el color nunca es el único indicador.
export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone}>
      <i className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}
