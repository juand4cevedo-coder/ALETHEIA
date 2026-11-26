import type { PublicPlan } from "../../api/generated";

// Plan que se destaca en el inicio y en precios. Es una decisión comercial, no un precio
// ni un límite, por eso vive aquí y no en el catálogo.
export const RECOMMENDED_PLAN = "professional";

// Para quién es cada plan (sección 6 de la especificación). Un plan nuevo sin texto aquí
// se muestra igual, solo que sin esta línea.
export const PLAN_TAGLINES: Readonly<Record<string, string>> = {
  trial: "Para probar ALETHEIA con sus casos reales y su equipo.",
  essential: "Para un abogado independiente y su asistente.",
  professional:
    "Para un despacho de hasta cuatro personas, con espacio para crecer.",
  firm: "Para firmas de diez personas o más.",
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

/** Lo que paga al mes un equipo de `people` personas en un plan, o null si el plan no admite
 * tantas. Sigue la regla del cobro (services/pricing.py): el plan más cada persona por encima
 * de las incluidas, si el plan admite adicionales. */
function monthlyCostFor(
  plan: PublicPlan,
  people: number,
): number | null {
  const extra = Math.max(people - plan.included_users, 0);
  if (extra === 0) return plan.monthly_price_cop;
  if (plan.extra_user_price_cop == null) return null;
  return plan.monthly_price_cop + extra * plan.extra_user_price_cop;
}

/** El plan pago más barato para un equipo de `people` personas, con lo que costaría al mes. */
export function cheapestPlanFor(
  plans: readonly PublicPlan[],
  people: number,
): { plan: PublicPlan; monthly: number; extra: number } | null {
  let best: { plan: PublicPlan; monthly: number; extra: number } | null = null;
  for (const plan of plans) {
    if (plan.monthly_price_cop === 0) continue;
    const monthly = monthlyCostFor(plan, people);
    if (monthly === null) continue;
    if (best === null || monthly < best.monthly) {
      best = {
        plan,
        monthly,
        extra: Math.max(people - plan.included_users, 0),
      };
    }
  }
  return best;
}
