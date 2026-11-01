import type { PublicPlan } from "../../api/generated";
import { CONTACT_EMAIL } from "../../config/site.ts";

// Plan que se destaca en el inicio y en precios. Es una decisión comercial, no un precio
// ni un límite, por eso vive aquí y no en el catálogo.
export const RECOMMENDED_PLAN = "professional";

// Para quién es cada plan (sección 6 de la especificación). Un plan nuevo sin texto aquí
// se muestra igual, solo que sin esta línea.
export const PLAN_TAGLINES: Readonly<Record<string, string>> = {
  trial: "Para conocer el ciclo completo con sus propios archivos.",
  essential: "Para el abogado independiente que empieza.",
  professional: "Para el independiente consolidado que trabaja con asistente.",
  firm: "Para firmas pequeñas y medianas.",
};

// El Corporativo no tiene precio publicado: se contrata por cotización (TT-005).
export const CORPORATE_QUOTE_URL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Cotización del plan Corporativo")}`;

/** Días de la prueba gratuita según el catálogo, o null si el catálogo no trae una. */
export function trialDays(plans: readonly PublicPlan[]): number | null {
  const trial = plans.find(
    (plan) => plan.monthly_price_cop === 0 && plan.trial_days != null,
  );
  return trial?.trial_days ?? null;
}
