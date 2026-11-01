import { FileQuestionMark, ImageOff, Scale, UsersRound } from "lucide-react";
import { useRef } from "react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import { useSpotlight } from "../../components/ui/useSpotlight.ts";
import styles from "./ProblemSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";

const PROBLEMS = [
  {
    icon: ImageOff,
    title: "La captura pierde información",
    text: "Un pantallazo o una impresión dejan atrás los metadatos del archivo: fechas, formato y el contenido completo del mensaje. Lo que llega al expediente ya no es el original.",
  },
  {
    icon: FileQuestionMark,
    title: "No hay cómo probar que no cambió",
    text: "Si nadie registró la huella del archivo al recibirlo, tampoco se puede demostrar después que el documento que se aporta es el mismo que llegó a la oficina.",
  },
  {
    icon: UsersRound,
    title: "Nadie sabe quién lo manipuló",
    text: "Entre correos, memorias USB y carpetas compartidas no queda registro de quién abrió, copió o modificó cada archivo, ni en qué momento lo hizo.",
  },
] as const;

// Por qué importa el original: el problema que resuelve ALETHEIA.
export function ProblemSection() {
  const gridRef = useRef<HTMLUListElement>(null);
  useSpotlight(gridRef);

  return (
    <section className={section.section} aria-labelledby="titulo-problema">
      <div className={section.inner}>
        <SectionHeading
          id="titulo-problema"
          kicker="Por qué importa"
          title="Una captura de pantalla no es el archivo original"
          lead="En un proceso, la evidencia digital se valora a partir de su formato original o de uno que lo reproduzca con exactitud. Conservarla bien desde el primer día evita discusiones que no deberían existir."
        />

        <ul ref={gridRef} className={styles.grid}>
          {PROBLEMS.map((problem, index) => (
            <Reveal
              as="li"
              key={problem.title}
              delay={(index + 1) as 1 | 2 | 3}
              className={styles.item}
            >
              <div data-spotlight className={`${section.card} ${styles.card}`}>
                <span className={section.iconTile}>
                  <problem.icon size={22} />
                </span>
                <h3 className={section.cardTitle}>{problem.title}</h3>
                <p className={section.cardText}>{problem.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>

        <Reveal className={styles.source}>
          <Scale size={16} />
          <p>
            Código General del Proceso, artículo 247, y Corte Constitucional,
            sentencia C-604 de 2016.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
