import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import timeline from "./Timeline.module.css";
import styles from "./VerifierSection.module.css";
import {
  ArchivoBusquedaIcon,
  PortatilIcon,
  RelojIcon,
  VerificadoIcon,
} from "../../components/ui/icons.tsx";

const STEPS = [
  {
    icon: ArchivoBusquedaIcon,
    title: "Sin cuenta ni pago",
    text: "El verificador estará en el sitio de ALETHEIA y no pedirá crear una cuenta.",
  },
  {
    icon: PortatilIcon,
    title: "La huella se calcula en el navegador",
    text: "Se eligen el archivo y el manifiesto del paquete. El archivo no se enviará a ningún servidor.",
  },
  {
    icon: VerificadoIcon,
    title: "Un resultado por archivo",
    text: "Cada archivo coincide o no coincide con lo que usted preservó.",
  },
] as const;

// Verificador: ¿puede comprobarlo la contraparte sin una cuenta? El verificador llega con la
// versión 1.0 (HU-026); hasta entonces no hay ruta, así que la sección lo explica sin enlazar
// a una página vacía. La navegación «Verificar» trae a esta sección (ROUTES.verifierSection).
export function VerifierSection() {
  return (
    <section
      id="verificador"
      className={section.section}
      aria-labelledby="titulo-verificador"
    >
      <div className={`${section.inner} ${styles.layout}`}>
        <div className={styles.copy}>
          <SectionHeading
            id="titulo-verificador"
            kicker="Verificador"
            title="La contraparte podrá comprobar el paquete sin una cuenta"
            lead="El juez, el perito o la contraparte podrán comprobar que cada archivo es el mismo que usted preservó."
            className={section.headingStacked}
          />
          <p className={styles.availability}>
            <RelojIcon size={16} aria-hidden="true" />
            El verificador público llega con la versión 1.0 de ALETHEIA.
          </p>
        </div>

        <ol className={timeline.timeline}>
          {STEPS.map((step) => (
            <li key={step.title} className={timeline.step}>
              <span className={timeline.node}>
                <step.icon size={16} aria-hidden="true" />
              </span>
              <div className={timeline.content}>
                <h3 className={section.cardTitle}>{step.title}</h3>
                <p className={section.cardText}>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
