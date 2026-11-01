import { Fingerprint, History, PackageCheck, Upload } from "lucide-react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import styles from "./HowItWorks.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";

const STEPS = [
  {
    icon: Upload,
    title: "Suba el original",
    text: "Cargue dentro de un caso el chat exportado, el correo, el audio, la fotografía o el PDF, tal como lo recibió. ALETHEIA lo guarda cifrado y sin modificarlo.",
  },
  {
    icon: Fingerprint,
    title: "Huella y sello de tiempo",
    text: "Al recibirlo se calcula su huella SHA‑256 y una autoridad externa la sella con fecha y hora. Desde ese momento, cualquier cambio en el archivo queda en evidencia.",
  },
  {
    icon: History,
    title: "Cadena de custodia",
    text: "Cada vez que alguien de su equipo sube, consulta, descarga o exporta la evidencia, queda registrado quién lo hizo y cuándo, en un historial que no se puede editar.",
  },
  {
    icon: PackageCheck,
    title: "Paquete verificable",
    text: "Exporte los originales con sus huellas, los sellos de tiempo y un informe de custodia en PDF, listo para aportar y para que cualquiera lo compruebe.",
  },
] as const;

// Los cuatro pasos del servicio, en el lenguaje del abogado. SHA‑256 lleva un guion que no
// parte la línea (U+2011).
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
          title="De la recepción del archivo al expediente, en cuatro pasos"
          lead="No necesita instalar nada ni cambiar la forma en que su oficina recibe la información. ALETHEIA se encarga de preservarla desde el primer momento."
        />

        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <Reveal
              as="li"
              key={step.title}
              delay={(index + 1) as 1 | 2 | 3 | 4}
              className={styles.step}
            >
              <span className={styles.icon}>
                <step.icon size={24} />
              </span>
              <p className={styles.number}>
                Paso {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className={section.cardTitle}>{step.title}</h3>
              <p className={section.cardText}>{step.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
