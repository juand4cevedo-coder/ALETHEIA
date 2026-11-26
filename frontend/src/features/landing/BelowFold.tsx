import { Reveal } from "../../components/ui/Reveal.tsx";
import { useEffect } from "react";
import { useLocation } from "react-router";

import { PlanCatalogProvider } from "../billing/catalog.tsx";
import { BenefitsSection } from "./BenefitsSection.tsx";
import { ClosingSection } from "./ClosingSection.tsx";
import { FaqSection } from "./FaqSection.tsx";
import { PlansSection } from "./PlansSection.tsx";
import { ProductTour } from "./ProductTour.tsx";
import { StatsSection } from "./StatsSection.tsx";
import { TeamSection } from "./TeamSection.tsx";

// Secciones de la landing que quedan debajo del primer pantallazo. Llegan en un archivo aparte
// que se pide mientras se pinta el inicio: el JavaScript que bloquea el primer pintado se queda
// dentro del presupuesto (especificación de identidad, sección 8).
export function BelowFold() {
  const { hash } = useLocation();
  // Si la dirección trae un ancla de estas secciones (/#como-funciona), el navegador no la
  // encontró al cargar: se lleva la vista hasta ella ahora que existe.
  useEffect(() => {
    let id: string;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      // Un enlace con un porcentaje incompleto no debe desmontar toda la página.
      return;
    }
    if (id) document.getElementById(id)?.scrollIntoView();
  }, [hash]);

  // Los planes y el cierre leen el mismo catálogo, pedido una sola vez. Empieza con la copia
  // publicada, así el HTML prerenderizado ya trae los precios.
  return (
    <PlanCatalogProvider publicado>
      <Reveal>
        <BenefitsSection />
      </Reveal>
      <Reveal>
        <StatsSection />
      </Reveal>
      <Reveal>
        <ProductTour />
      </Reveal>
      <Reveal>
        <TeamSection />
      </Reveal>
      <Reveal>
        <PlansSection />
      </Reveal>
      <Reveal>
        <FaqSection />
      </Reveal>
      <Reveal>
        <ClosingSection />
      </Reveal>
    </PlanCatalogProvider>
  );
}
