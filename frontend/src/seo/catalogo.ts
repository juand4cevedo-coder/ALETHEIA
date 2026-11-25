import { CATALOGO_PUBLICADO } from "../features/billing/published.ts";

// Precios públicos para los datos estructurados de la portada y de precios. Salen de la misma
// copia del catálogo con la que el sitio dibuja las tarjetas al construirse
// (features/billing/catalogo-publicado.json), así que lo que dice el JSON-LD es lo mismo que se
// ve en la página. Corporativo se cotiza y no se publica.
export type PlanPublicado = {
  codigo: string;
  nombre: string;
  /** Pesos colombianos por mes. */
  mensual: number;
  /** Pesos colombianos por año, si el plan se vende por año. */
  anual: number | null;
  /** Pesos colombianos por mes de cada usuario adicional, si el plan lo permite. */
  usuarioAdicional: number | null;
  /** Días de prueba, solo en la prueba gratuita. */
  diasDePrueba: number | null;
};

export const PLANES_PUBLICADOS: readonly PlanPublicado[] = CATALOGO_PUBLICADO.map(
  (plan) => ({
    codigo: plan.code,
    nombre: plan.name,
    mensual: plan.monthly_price_cop,
    anual: plan.annual_price_cop ?? null,
    usuarioAdicional: plan.extra_user_price_cop ?? null,
    diasDePrueba: plan.trial_days ?? null,
  }),
);
