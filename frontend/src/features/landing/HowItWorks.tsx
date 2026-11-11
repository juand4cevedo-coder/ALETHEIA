import { EvidencePreview } from "./EvidencePreview.tsx";
import styles from "./HowItWorks.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import {
  CadenaIcon,
  HuellaIcon,
  PaqueteIcon,
  SelloIcon,
  SubirIcon,
} from "../../components/ui/icons.tsx";

// Cada paso lleva el mismo ícono que su fila en la vista de la evidencia, para leerlos juntos.
const STEPS = [
  {
    icon: SubirIcon,
    title: "Suba el original",
    text: "El archivo tal como le llegó, sin convertirlo. Queda cifrado con la llave del caso.",
  },
  {
    icon: HuellaIcon,
    title: "ALETHEIA calcula su huella",
    text: "Un código SHA-256 que cambia por completo si el archivo cambia en un solo byte.",
  },
  {
    icon: SelloIcon,
    title: "Un tercero sella la huella",
    text: "Una autoridad de sellado de tiempo la firma con la fecha y la hora. Así consta que el archivo existía en ese momento.",
  },
  {
    icon: PaqueteIcon,
    title: "Exporte el paquete",
    text: "Los originales, sus huellas, los sellos y el informe de custodia, en un archivo listo para aportar al proceso.",
  },
] as const;

// Cómo funciona: qué pasa con el archivo desde que se sube. Los cuatro pasos a la izquierda y, a
// la derecha, la evidencia como se ve en la aplicación.
export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className={section.section}
      aria-labelledby="titulo-como-funciona"
    >
      <div className={section.inner}>
        <SectionHeading
          id="titulo-como-funciona"
          kicker="Cómo funciona"
          title="Lo que pasa con su archivo desde que lo sube"
        />

        <div className={styles.layout}>
          <div>
            <ol className={styles.steps}>
              {STEPS.map((step) => (
                <li key={step.title} className={styles.step}>
                  <span className={styles.marker}>
                    <step.icon size={16} aria-hidden="true" />
                  </span>
                  <div className={styles.copy}>
                    <h3 className={section.cardTitle}>{step.title}</h3>
                    <p className={section.cardText}>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className={styles.custody}>
              <CadenaIcon size={16} aria-hidden="true" />
              <span>
                Durante todo el proceso, la cadena de custodia anota quién abre
                o descarga el archivo, y a qué hora.
              </span>
            </p>
          </div>

          <EvidencePreview />
        </div>
      </div>
    </section>
  );
}
