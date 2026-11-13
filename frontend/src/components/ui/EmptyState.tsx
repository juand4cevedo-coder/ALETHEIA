import type { ReactNode } from "react";

import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  /** Panel lateral opcional, por ejemplo una vista previa de lo que aparecerá aquí. */
  aside?: ReactNode;
};

// Pantalla vacía: explica qué falta y ofrece el primer paso; el panel lateral es opcional.
export function EmptyState({
  title,
  description,
  actions,
  aside,
}: EmptyStateProps) {
  return (
    <section className={styles.empty} data-aside={aside ? "true" : undefined}>
      <div className={styles.text}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {aside && <div className={styles.aside}>{aside}</div>}
    </section>
  );
}
