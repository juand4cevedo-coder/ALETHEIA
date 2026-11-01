import type { PublicPlan } from "../api/generated";

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

// Catálogo de prueba igual al que siembra la migración 0003, con la forma que devuelve
// GET /api/v1/plans.
export const CATALOG: PublicPlan[] = [
  {
    code: "trial",
    name: "Prueba",
    monthly_price_cop: 0,
    annual_price_cop: null,
    included_users: 1,
    extra_user_price_cop: null,
    storage_limit_bytes: 1 * GIB,
    max_file_bytes: 100 * MIB,
    trial_days: 14,
  },
  {
    code: "essential",
    name: "Esencial",
    monthly_price_cop: 29_900,
    annual_price_cop: 299_000,
    included_users: 1,
    extra_user_price_cop: null,
    storage_limit_bytes: 10 * GIB,
    max_file_bytes: 250 * MIB,
    trial_days: null,
  },
  {
    code: "professional",
    name: "Profesional",
    monthly_price_cop: 59_900,
    annual_price_cop: 599_000,
    included_users: 2,
    extra_user_price_cop: null,
    storage_limit_bytes: 50 * GIB,
    max_file_bytes: 1 * GIB,
    trial_days: null,
  },
  {
    code: "firm",
    name: "Firma",
    monthly_price_cop: 149_900,
    annual_price_cop: 1_499_000,
    included_users: 8,
    extra_user_price_cop: 14_900,
    storage_limit_bytes: 200 * GIB,
    max_file_bytes: 2 * GIB,
    trial_days: null,
  },
];
