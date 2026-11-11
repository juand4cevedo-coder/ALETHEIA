import type { ReactNode } from "react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import styles from "./Section.module.css";

type SectionHeadingProps = {
  id: string;
  index: number;
  kicker: string;
  title: ReactNode;
  lead?: ReactNode;
  // Variante de composición, por ejemplo el encabezado apilado de una columna lateral.
  className?: string;
};

// Encabezado de cada sección del inicio, foliado como un expediente: a la izquierda el folio
// («§ 02») con su regla y la etiqueta; a la derecha el título (h2) y la entrada. El folio es
// decorativo (aria-hidden): la etiqueta sigue siendo el texto que leen los lectores de pantalla.
export function SectionHeading({
  id,
  index,
  kicker,
  title,
  lead,
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={className ? `${styles.heading} ${className}` : styles.heading}
    >
      <div className={styles.folioBlock}>
        <p className={styles.folio} aria-hidden="true">
          § 0{index}
        </p>
        <p className={styles.kicker}>{kicker}</p>
      </div>
      <div className={styles.headingBody}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {lead && <p className={styles.lead}>{lead}</p>}
      </div>
    </Reveal>
  );
}
