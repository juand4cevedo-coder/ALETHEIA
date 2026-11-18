import type { ReactNode } from "react";
import { useId } from "react";

import styles from "./Panel.module.css";

type PanelProps = {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** compact: listas densas (filas, tablas). comfortable (por defecto): formularios y fichas. */
  density?: "comfortable" | "compact";
};

// Panel genérico de una pantalla (especificación de identidad, sección 6): línea y superficie dan
// la profundidad, nunca una sombra. Un título es opcional porque no todo panel necesita uno.
export function Panel({
  title,
  description,
  actions,
  children,
  density = "comfortable",
}: PanelProps) {
  const titleId = useId();
  return (
    <section
      className={styles.panel}
      data-density={density}
      aria-labelledby={title ? titleId : undefined}
    >
      {(title || actions) && (
        <div className={styles.head}>
          <div className={styles.headText}>
            {title && (
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            )}
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
