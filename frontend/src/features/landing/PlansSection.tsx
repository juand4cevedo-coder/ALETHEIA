import { Link } from "react-router";

import { ROUTES } from "../../config/routes.ts";
import { usePlanCatalog } from "../billing/catalog.tsx";
import { annualMonthsSaved } from "../billing/format.ts";
import { PlanSummary } from "../billing/PlanSummary.tsx";
import styles from "./PlansSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";

// Precios: ¿cuánto cuesta? Precios, límites y días de prueba salen del catálogo (RN-019), nunca
// de este archivo; el enlace lleva a la comparación completa (UI-002).
export function PlansSection() {
  const { plans } = usePlanCatalog();
  const monthsSaved = plans ? annualMonthsSaved(plans) : null;
  return (
    <section className={section.section} aria-labelledby="titulo-planes">
      <div className={section.inner}>
        <SectionHeading
          id="titulo-planes"
          title="Todos los planes traen las mismas funciones; cambian los usuarios y el almacenamiento"
          lead="Sello de tiempo, cadena de custodia, paquete de preservación y portal del cliente vienen en cada plan. Los precios están en pesos colombianos."
        />
        <PlanSummary />
        <div className={styles.more}>
          <Link to={ROUTES.pricing} className={styles.link}>
            Ver planes y precios
            <FlechaDerechaIcon size={16} aria-hidden="true" />
          </Link>
          {monthsSaved !== null && (
            <p className={styles.note}>
              {monthsSaved === 1
                ? "Pagando el año, 1 mes le sale gratis."
                : `Pagando el año, ${monthsSaved} meses le salen gratis.`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
