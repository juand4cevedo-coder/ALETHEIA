import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { ROUTES } from "../../config/routes.ts";
import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";
import styles from "./HowItWorks.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";

const STEPS = [
  {
    title: "Reúna a su equipo",
    text: "Invite a las personas con las que trabaja y asigne un rol a cada una.",
  },
  {
    title: "Dé un lugar a cada caso",
    text: "Guarde su radicado, especialidad y despacho. Retome el contexto sin empezar de nuevo.",
  },
  {
    title: "Trabajen con claridad",
    text: "Consulte los casos a los que pertenece y encuentre a las personas responsables.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      data-reveal
      id="como-funciona"
      className={section.section}
      aria-labelledby="titulo-como-funciona"
    >
      <div className={section.inner}>
        <SectionHeading
          id="titulo-como-funciona"
          kicker="Así empieza todo"
          title="Un poco de orden. Mucho más espacio para pensar."
          lead="Lo esencial, a mano. Sin tener que aprender una forma distinta de trabajar."
        />
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.marker} aria-hidden="true">
                0{index + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <div className={styles.action}>
          <ButtonLink to={ROUTES.signUp} variant="secondary">
            Organizar mi espacio
            <FlechaDerechaIcon size={18} aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
