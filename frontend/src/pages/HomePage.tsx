import { SITE_NAME, SITE_URL } from "../config/site.ts";
import { ClosingSection } from "../features/landing/ClosingSection.tsx";
import { FaqSection } from "../features/landing/FaqSection.tsx";
import { Hero } from "../features/landing/Hero.tsx";
import { HowItWorks } from "../features/landing/HowItWorks.tsx";
import { PlansSection } from "../features/landing/PlansSection.tsx";
import { ProblemSection } from "../features/landing/ProblemSection.tsx";
import { ScopeSection } from "../features/landing/ScopeSection.tsx";
import { StandardsSection } from "../features/landing/StandardsSection.tsx";
import { VerifierSection } from "../features/landing/VerifierSection.tsx";
import styles from "./HomePage.module.css";

// Página de inicio (UI-001, HU-001). El orden sigue la decisión del visitante: qué es, por qué
// importa, cómo funciona, por qué confiar, qué no hace, quién más lo usa, cuánto cuesta y
// las dudas que quedan.
export function HomePage() {
  return (
    <div className={styles.page}>
      <title>{`${SITE_NAME} · Preservación de evidencia digital para abogados`}</title>
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
    </div>
  );
}
