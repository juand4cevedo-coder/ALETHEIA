import { useEffect } from "react";
import { useLocation } from "react-router";

import { ClosingSection } from "./ClosingSection.tsx";
import { FaqSection } from "./FaqSection.tsx";
import { HowItWorks } from "./HowItWorks.tsx";
import { PlansSection } from "./PlansSection.tsx";
import { ScopeSection } from "./ScopeSection.tsx";
import { StandardsSection } from "./StandardsSection.tsx";
import { VerifierSection } from "./VerifierSection.tsx";
import { ProductTour } from "./ProductTour.tsx";

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

  useEffect(() => {
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const sections = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "true");
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top > window.innerHeight) {
        section.setAttribute("data-reveal-ready", "true");
        observer.observe(section);
      }
    });
    return () => {
      observer.disconnect();
      sections.forEach((section) =>
        section.removeAttribute("data-reveal-ready"),
      );
    };
  }, []);

  return (
    <>
      <ProductTour />
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
