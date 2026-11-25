import type { PublicPlan } from "../../api/generated";

// Plan que se destaca en el inicio y en precios. Es una decisión comercial, no un precio
// ni un límite, por eso vive aquí y no en el catálogo.
export const RECOMMENDED_PLAN = "professional";

// Para quién es cada plan (sección 6 de la especificación). Un plan nuevo sin texto aquí
// se muestra igual, solo que sin esta línea.
export const PLAN_TAGLINES: Readonly<Record<string, string>> = {
  trial: "Para probar ALETHEIA con sus casos antes de elegir un plan.",
  essential: "Si ejerce por su cuenta y está empezando.",
  professional: "Si ya tiene clientela estable y trabaja con un asistente.",
  firm: "Si trabaja en una firma pequeña o mediana.",
};

// El Corporativo no tiene precio publicado: se contrata por cotización (TT-005), con el
// formulario de la página para empresas.
export const CORPORATE_QUOTE_URL = "/empresa#cotizar";

/** Días de la prueba gratuita según el catálogo, o null si el catálogo no trae una. */
export function trialDays(plans: readonly PublicPlan[]): number | null {
  const trial = plans.find(
    (plan) => plan.monthly_price_cop === 0 && plan.trial_days != null,
  );
  return trial?.trial_days ?? null;
}
