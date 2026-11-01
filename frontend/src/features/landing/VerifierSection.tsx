import { ArrowRight, BadgeCheck, FileSearch, Laptop } from "lucide-react";

import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { Reveal } from "../../components/ui/Reveal.tsx";
import { ROUTES } from "../../config/routes.ts";
import section from "./Section.module.css";
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

// Para quien recibe un paquete: juez, perito o contraparte (UI-005).
export function VerifierSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-verificador">
      <div className={section.inner}>
        <Reveal className={styles.panel}>
          <div className={styles.copy}>
            <p className={section.kicker}>
              Para jueces, peritos y contrapartes
            </p>
            <h2 id="titulo-verificador" className={styles.title}>
              ¿Recibió un paquete de preservación?
            </h2>
            <p className={styles.text}>
              Compruebe por su cuenta que cada archivo es el mismo que se
              preservó. La verificación es pública, gratuita e independiente de
              quien aportó el paquete.
            </p>
            <ButtonLink to={ROUTES.verifier} surface="dark">
              Verificar un archivo
              <ArrowRight size={18} />
            </ButtonLink>
          </div>

          <ol className={styles.steps}>
            {STEPS.map((step) => (
              <li key={step.text} className={styles.step}>
                <span className={section.iconTile}>
                  <step.icon size={20} />
                </span>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
