import type { ReactNode } from "react";

import styles from "./PageHeader.module.css";

type PageHeaderProps = {
  /** Etiqueta pequeña sobre el título. */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

// Encabezado de pantalla del espacio de trabajo: etiqueta, título, apoyo y acciones.
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
