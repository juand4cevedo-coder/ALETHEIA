import axe from "axe-core";

// Errores graves según axe: los que impiden o dificultan mucho usar la página. Son los que
// cuenta el criterio "sin errores graves en la revisión de accesibilidad" (RNF-013).
const SERIOUS_IMPACTS = new Set(["serious", "critical"]);

/** Ejecuta axe sobre el elemento y devuelve las fallas graves, en texto legible. */
export async function seriousAxeViolations(
  element: Element,
): Promise<string[]> {
  const results = await axe.run(element, {
    rules: {
      // jsdom no calcula colores ni tamaños; el contraste ya se validó en el documento de
      // Diseño (sección 12.3) y se revisa en el navegador.
      "color-contrast": { enabled: false },
    },
  });
  return results.violations
    .filter((violation) => SERIOUS_IMPACTS.has(violation.impact ?? ""))
    .map(
      (violation) =>
        `${violation.id}: ${violation.help} (${violation.nodes.length} elementos)`,
    );
}
