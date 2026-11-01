import type { ReactNode } from "react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import styles from "./Section.module.css";

type SectionHeadingProps = {
  id: string;
  kicker: string;
  title: ReactNode;
  lead?: ReactNode;
};

// Encabezado de cada sección del inicio: etiqueta, título (h2) y entrada, centrados.
export function SectionHeading({
  id,
  kicker,
  title,
  lead,
}: SectionHeadingProps) {
  return (
    <Reveal className={styles.heading}>
      <p className={styles.kicker}>{kicker}</p>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {lead && <p className={styles.lead}>{lead}</p>}
    </Reveal>
  );
}
