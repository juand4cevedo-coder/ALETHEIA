import { Fingerprint, History, PackageCheck, Upload } from "lucide-react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import styles from "./HowItWorks.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import timeline from "./Timeline.module.css";

const STEPS = [
  {
    icon: Upload,
    title: "Suba el original",
    text: "Cargue dentro de un caso el chat exportado, el correo, el audio, la fotografía o el PDF, tal como lo recibió. Lo guardamos cifrado y sin modificarlo.",
  },
  {
    icon: Fingerprint,
    title: "Huella y sello de tiempo",
    text: "Al recibirlo calculamos su huella SHA‑256 y una autoridad externa la sella con fecha y hora. Desde ese momento, cualquier cambio en el archivo queda en evidencia.",
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

// Los cuatro pasos del servicio, en el lenguaje del abogado, como una línea de tiempo: en
// pantallas anchas va en fila y en las angostas baja en vertical. SHA‑256 lleva un guion que no
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
          index={2}
          kicker="Cómo funciona"
          title="De la recepción del archivo al expediente, en cuatro pasos"
          lead="No necesita instalar nada ni cambiar la forma en que su oficina recibe la información. Nosotros nos encargamos de preservarla desde el primer momento."
        />

        <ol className={`${timeline.timeline} ${timeline.horizontal}`}>
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} className={timeline.step}>
              <span className={timeline.node}>
                <step.icon size={20} />
              </span>
              <div className={timeline.content}>
                <p className={styles.number}>
                  Paso {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className={section.cardTitle}>{step.title}</h3>
                <p className={section.cardText}>{step.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
