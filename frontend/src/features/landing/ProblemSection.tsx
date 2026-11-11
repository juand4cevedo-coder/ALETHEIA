import { Scale } from "lucide-react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import styles from "./ProblemSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";

const PROBLEMS = [
  {
    title: "La captura pierde información",
    text: "Un pantallazo o una impresión dejan atrás los metadatos del archivo: fechas, formato y el contenido completo del mensaje. Lo que llega al expediente ya no es el original.",
  },
  {
    title: "No hay cómo probar que no cambió",
    text: "Si nadie registró la huella del archivo al recibirlo, tampoco se puede demostrar después que el documento que se aporta es el mismo que llegó a la oficina.",
  },
  {
    title: "Nadie sabe quién lo manipuló",
    text: "Entre correos, memorias USB y carpetas compartidas no queda registro de quién abrió, copió o modificó cada archivo, ni en qué momento lo hizo.",
  },
] as const;

// Por qué importa el original: el problema que resuelve ALETHEIA. Se lee como un alegato: el
// planteamiento a la izquierda y los tres puntos numerados a la derecha, con la norma como nota
// al pie. Los números son decorativos (aria-hidden): la <ol> ya comunica el orden.
export function ProblemSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-problema">
      <div className={`${section.inner} ${styles.layout}`}>
        <SectionHeading
          id="titulo-problema"
          index={1}
          kicker="Por qué importa"
          title="Una captura de pantalla no es el archivo original"
          lead="En un proceso, la evidencia digital se valora a partir de su formato original o de uno que lo reproduzca con exactitud. Conservarla bien desde el primer día evita discusiones que no deberían existir."
          className={`${section.headingStacked} ${styles.heading}`}
        />

        <div className={styles.body}>
          <ol className={styles.list}>
            {PROBLEMS.map((problem, index) => (
              <Reveal as="li" key={problem.title} className={styles.item}>
                <span className={styles.number} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className={styles.copy}>
                  <h3 className={section.cardTitle}>{problem.title}</h3>
                  <p className={section.cardText}>{problem.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>

          <Reveal className={styles.source}>
            <Scale size={16} />
            <p>
              Código General del Proceso, artículo 247, y Corte Constitucional,
              sentencia C-604 de 2016.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
