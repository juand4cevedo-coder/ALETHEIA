import type { ReactNode } from "react";

import styles from "./Section.module.css";

type SectionHeadingProps = {
  id: string;
  /** Nombre corto de la sección sobre el título, en gris: orienta sin competir con el título. */
  kicker?: string;
  title: ReactNode;
  lead?: ReactNode;
  // Variante de composición, por ejemplo el encabezado apilado de una columna lateral.
  className?: string;
};

// Encabezado de cada sección del inicio: el nombre de la sección, el título (h2) que responde la
// pregunta del abogado y, si hace falta, una entrada breve.
export function SectionHeading({
  id,
  kicker,
  title,
  lead,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={className ? `${styles.heading} ${className}` : styles.heading}
    >
      {kicker && <p className={styles.kicker}>{kicker}</p>}
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {lead && <p className={styles.lead}>{lead}</p>}
    </div>
  );
}
