import type { PublicPlan } from "../../api/generated";

export type BillingCycle = "monthly" | "annual";

const pesos = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
  useGrouping: "always",
});
const sizes = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;
const TIB = 1024 ** 4;

/** Pesos colombianos sin decimales y con punto de miles: $59.900. */
export function formatCop(value: number): string {
  return `$${pesos.format(value)}`;
}

/** Tamaños en unidades binarias, como los muestra Windows, con una cifra decimal como máximo. */
export function formatBytes(bytes: number): string {
  if (bytes >= TIB) return `${sizes.format(bytes / TIB)} TB`;
  if (bytes >= GIB) return `${sizes.format(bytes / GIB)} GB`;
  return `${sizes.format(bytes / MIB)} MB`;
}

/** Cuántos meses de precio mensual cobra el pago anual, si es un número exacto. */
export function annualMonthsCharged(plan: PublicPlan): number | null {
  if (plan.annual_price_cop == null || plan.monthly_price_cop === 0)
    return null;
  const months = plan.annual_price_cop / plan.monthly_price_cop;
  return Number.isInteger(months) ? months : null;
}

/** Meses que se ahorran al pagar el año, si todos los planes anuales coinciden. */
export function annualMonthsSaved(plans: readonly PublicPlan[]): number | null {
  const charged = new Set(
    plans.map(annualMonthsCharged).filter((months) => months !== null),
  );
  if (charged.size !== 1) return null;
  const [months] = charged;
  return months !== undefined && months < 12 ? 12 - months : null;
}
