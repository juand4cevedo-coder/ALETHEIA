import { pageTitle, SITE_URL } from "../config/site.ts";
import { ClosingSection } from "../features/landing/ClosingSection.tsx";
import { FaqSection } from "../features/landing/FaqSection.tsx";
import { Hero } from "../features/landing/Hero.tsx";
import { HowItWorks } from "../features/landing/HowItWorks.tsx";
import { PlansSection } from "../features/landing/PlansSection.tsx";
import { ProblemSection } from "../features/landing/ProblemSection.tsx";
import { ScopeSection } from "../features/landing/ScopeSection.tsx";
import { StandardsSection } from "../features/landing/StandardsSection.tsx";
import { VerifierSection } from "../features/landing/VerifierSection.tsx";

// Página de inicio (UI-001, HU-001). Cada sección responde una pregunta del abogado, en el
// orden en que se la hace (especificación de identidad, sección 11).
export function HomePage() {
  return (
    <>
      <title>
        {pageTitle("Preservación de evidencia digital para abogados")}
      </title>
      <meta
        name="description"
        content="Conserve el archivo original de cada evidencia digital con su huella SHA-256, un sello de tiempo de un tercero y una cadena de custodia que no se puede editar. Para abogados y firmas en Colombia."
      />
      <link rel="canonical" href={`${SITE_URL}/`} />

      <Hero />
      <ProblemSection />
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
