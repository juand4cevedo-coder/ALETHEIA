import { ChainDemo } from "./ChainDemo.tsx";
import { HashDemo } from "./HashDemo.tsx";
import { StampCard } from "./StampCard.tsx";
import {
  ChevronAbajoIcon,
  LlaveIcon,
  DispositivosIcon,
} from "../../components/ui/icons.tsx";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import styles from "./StandardsSection.module.css";

export function StandardsSection() {
  return (
    <section
      data-reveal
      id="seguridad"
      className={`${section.section} ${styles.section}`}
      aria-labelledby="titulo-estandares"
    >
      <div className={section.inner}>
        <SectionHeading
          id="titulo-estandares"
          kicker="El cuidado también está por dentro"
          title="Saber qué ocurre. Decidir quién participa."
          lead="Su información merece atención. Cada caso tiene sus miembros y usted puede revisar sus accesos desde su cuenta."
        />
        <ul className={styles.guarantees}>
          <li>
            <LlaveIcon size={24} aria-hidden="true" />
            <h3>Permisos por caso</h3>
            <p>
              La información está disponible para quienes forman parte del caso.
            </p>
          </li>
          <li>
            <DispositivosIcon size={24} aria-hidden="true" />
            <h3>Control de sus sesiones</h3>
            <p>
              Cambie su contraseña y cierre las sesiones de todos sus
              dispositivos.
            </p>
          </li>
        </ul>
        <div className={styles.details}>
          <p className={styles.detailIntro}>
            Si quiere conocer los fundamentos de la evidencia digital, aquí
            puede explorarlos a su ritmo.
          </p>
          <details id="huella-demo" className={styles.detail}>
            <summary>
              ¿Cómo se detecta un cambio en un archivo?
              <ChevronAbajoIcon size={18} aria-hidden="true" />
            </summary>
            <div className={styles.explanation}>
              <h3>La huella SHA-256</h3>
              <p>
                El mismo contenido produce la misma huella. Cambie el texto del
                ejemplo para ver qué ocurre.
              </p>
              <HashDemo />
            </div>
          </details>
          <details className={styles.detail}>
            <summary>
              ¿Para qué sirve una cadena de custodia?
              <ChevronAbajoIcon size={18} aria-hidden="true" />
            </summary>
            <div className={styles.explanation}>
              <h3>La cadena de custodia</h3>
              <p>
                Documenta el recorrido de una evidencia. En esta demostración,
                cada registro enlaza con el anterior y permite advertir cambios.
              </p>
              <ChainDemo />
            </div>
          </details>
          <details className={styles.detail}>
            <summary>
              ¿Qué aporta un sello de tiempo?
              <ChevronAbajoIcon size={18} aria-hidden="true" />
            </summary>
            <div className={styles.explanation}>
              <h3>El sello de tiempo</h3>
              <p>
                Vincula una huella con una fecha y hora mediante la firma de una
                autoridad de sellado. Este es un ejemplo ilustrativo.
              </p>
              <StampCard />
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
