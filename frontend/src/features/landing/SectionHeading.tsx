import type { ReactNode } from "react";

import styles from "./Section.module.css";

type SectionHeadingProps = {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  // Variante de composición, por ejemplo el encabezado apilado de una columna lateral.
  className?: string;
};

// Encabezado de cada sección del inicio: el título (h2) que responde la pregunta del abogado y,
// si hace falta, una entrada breve.
export function SectionHeading({
  id,
  title,
  lead,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={className ? `${styles.heading} ${className}` : styles.heading}
    >
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {lead && <p className={styles.lead}>{lead}</p>}
    </div>
  );
}
