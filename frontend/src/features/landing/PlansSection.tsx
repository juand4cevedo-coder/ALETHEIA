import { Link } from "react-router";

import { Reveal } from "../../components/ui/Reveal.tsx";
import { ROUTES } from "../../config/routes.ts";
import { PlanSummary } from "../billing/PlanSummary.tsx";
import styles from "./PlansSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";

// Planes desde el catálogo, con enlace a la comparación completa (UI-002).
export function PlansSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-planes">
      <div className={section.inner}>
        <SectionHeading
          id="titulo-planes"
          kicker="Planes"
          title="Las mismas garantías en todos los planes"
          lead="Todos los planes preservan igual: huella, sello de tiempo, cadena de custodia, exportación y verificador. Lo que cambia es la capacidad, el número de usuarios y el soporte."
        />
        <Reveal>
          <PlanSummary />
        </Reveal>
        <Reveal className={styles.more}>
          <Link to={ROUTES.pricing} className={styles.link}>
            Comparar los planes en detalle y ver el pago anual
            <FlechaDerechaIcon size={16} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
