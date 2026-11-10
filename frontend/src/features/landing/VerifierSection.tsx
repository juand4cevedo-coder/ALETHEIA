import { BadgeCheck, FileSearch, Laptop } from "lucide-react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import section from "./Section.module.css";
import timeline from "./Timeline.module.css";
import styles from "./VerifierSection.module.css";

const STEPS = [
  {
    icon: FileSearch,
    text: "Abra el verificador público. No necesita crear una cuenta.",
  },
  {
    icon: Laptop,
    text: "Seleccione el archivo y el manifiesto del paquete. La comprobación ocurre en su navegador: el archivo no se envía a ningún servidor.",
  },
  {
    icon: BadgeCheck,
    text: "Obtenga un resultado claro para cada archivo: coincide o no coincide con lo que se preservó.",
  },
] as const;

// Para quien recibe un paquete: juez, perito o contraparte (UI-005). Los tres pasos usan la
// misma línea de tiempo de Cómo funciona (§ 02): también son una secuencia.
export function VerifierSection() {
  return (
    <section
      id="verificador"
      className={section.section}
      aria-labelledby="titulo-verificador"
    >
      <div className={section.inner}>
        <Reveal className={styles.panel}>
          <div className={styles.copy}>
            <div className={section.folioBlock}>
              <p className={section.folio} aria-hidden="true">
                § 05
              </p>
              <p className={section.kicker}>
                Para jueces, peritos y contrapartes
              </p>
            </div>
            <h2 id="titulo-verificador" className={styles.title}>
              ¿Recibió un paquete de preservación?
            </h2>
            <p className={styles.text}>
              Compruebe por su cuenta que cada archivo es el mismo que se
              preservó. La verificación es pública, gratuita e independiente de
              quien aportó el paquete.
            </p>
            {/* El verificador llega con HU-026: hasta entonces no hay botón a una página vacía. */}
            <p className={styles.availability}>
              Abrimos el verificador público con la versión 1.0.0, el 27 de
              noviembre de 2026.
            </p>
          </div>

          <ol className={timeline.timeline}>
            {STEPS.map((step) => (
              <li key={step.text} className={timeline.step}>
                <span className={timeline.node}>
                  <step.icon size={20} />
                </span>
                <p className={`${timeline.content} ${styles.stepText}`}>
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
