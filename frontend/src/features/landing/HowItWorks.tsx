import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { ROUTES } from "../../config/routes.ts";
import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";
import styles from "./HowItWorks.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import { photoProps } from "../../config/media.ts";

const STEPS = [
  {
    title: "Abra el caso",
    text: "Escriba el radicado, la especialidad y el despacho, para encontrarlo después sin buscar en carpetas.",
  },
  {
    title: "Suba la evidencia",
    text: "Cada archivo recibe su huella SHA-256 y su sello de tiempo. Usted declara de dónde viene y queda anotado quién lo subió.",
  },
  {
    title: "Agregue a quien participa",
    text: "Invite a su equipo y decida quién entra a cada caso. Las demás personas del despacho no lo ven.",
  },
] as const;

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
          title="Su primer caso con evidencia sellada, en tres pasos"
          lead="Abre el caso como abriría una carpeta. Desde ahí, ALETHEIA anota lo que pasa con cada archivo."
        />
        <div className={styles.layout}>
          <img
            {...photoProps("producto-real", "(min-width: 900px) 50vw, 100vw")}
            alt="Personas trabajando en una oficina colorida"
            className={styles.photo}
            width={1280}
            height={720}
            loading="lazy"
            decoding="async"
          />
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.marker} aria-hidden="true">
                  0{index + 1}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className={styles.action}>
          <ButtonLink to={ROUTES.signUp} variant="secondary">
            Abrir mi primer caso gratis
            <FlechaDerechaIcon size={18} aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
