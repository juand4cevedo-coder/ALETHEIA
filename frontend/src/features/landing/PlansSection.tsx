import { Link } from "react-router";

import { ROUTES } from "../../config/routes.ts";
import { PlanSummary } from "../billing/PlanSummary.tsx";
import styles from "./PlansSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";

// Precios: ¿cuánto cuesta? Precios, límites y días de prueba salen del catálogo (RN-019), nunca
// de este archivo; el enlace lleva a la comparación completa (UI-002).
export function PlansSection() {
  return (
    <section
      data-reveal
      className={section.section}
      aria-labelledby="titulo-planes"
    >
      <div className={section.inner}>
        <SectionHeading
          id="titulo-planes"
          kicker="Precios"
          title="Un espacio a la medida de su práctica."
          lead="Compare la capacidad, los integrantes y las condiciones de cada plan. Todos los valores se muestran en pesos colombianos."
        />
        <PlanSummary />
        <p className={styles.more}>
          <Link to={ROUTES.pricing} className={styles.link}>
            Comparar los planes y ver el pago anual
            <FlechaDerechaIcon size={16} aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}
