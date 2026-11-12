import { useEffect } from "react";

import { ClosingSection } from "./ClosingSection.tsx";
import { FaqSection } from "./FaqSection.tsx";
import { HowItWorks } from "./HowItWorks.tsx";
import { PlansSection } from "./PlansSection.tsx";
import { ScopeSection } from "./ScopeSection.tsx";
import { StandardsSection } from "./StandardsSection.tsx";
import { VerifierSection } from "./VerifierSection.tsx";

// Secciones de la landing que quedan debajo del primer pantallazo. Llegan en un archivo aparte
// que se pide mientras se pinta el inicio: el JavaScript que bloquea el primer pintado se queda
// dentro del presupuesto (especificación de identidad, sección 8).
export function BelowFold() {
  // Si la dirección trae un ancla de estas secciones (/#como-funciona), el navegador no la
  // encontró al cargar: se lleva la vista hasta ella ahora que existe.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <>
      <HowItWorks />
      <StandardsSection />
      <ScopeSection />
      <VerifierSection />
      <PlansSection />
      <FaqSection />
      <ClosingSection />
    </>
  );
}
