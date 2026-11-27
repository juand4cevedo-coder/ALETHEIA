import type { ReactNode } from "react";

import type { PublicPlan } from "../../api/generated";
import {
  annualMonthlyEquivalent,
  annualSavingsCop,
  type BillingCycle,
  formatBytes,
  formatCop,
} from "./format.ts";
import styles from "./PlanCard.module.css";
import {
  ArchivoSubirIcon,
  DiscoIcon,
  UsuarioAgregarIcon,
  UsuariosIcon,
} from "../../components/ui/icons.tsx";

type PlanCardProps = {
  plan: PublicPlan;
  cycle: BillingCycle;
  recommended?: boolean;
  tagline?: string;
  /** Nivel del nombre del plan: 3 bajo el título de una sección, 2 bajo el de la página. */
  headingLevel?: 2 | 3;
  /** Botón al pie de la tarjeta. */
  action?: ReactNode;
};

// Tarjeta de plan (CMP-UI-012). Todos los precios y límites vienen del catálogo (RN-019).
// Toda cuenta nueva empieza con la prueba y el registro no cobra ni elige plan, así que el botón
// de la tarjeta lleva a la prueba y no promete un pago: el registro solo recuerda qué plan miró
// la persona. Sus cinco filas (nombre, para quién, precio, límites y botón) se alinean con las
// de las demás tarjetas por subgrid, para que se comparen de un vistazo.
export function PlanCard({
  plan,
  cycle,
  recommended = false,
  tagline,
  headingLevel = 3,
  action,
}: PlanCardProps) {
  const isFree = plan.monthly_price_cop === 0;
  const showsAnnual = cycle === "annual" && plan.annual_price_cop != null;
  const monthly = annualMonthlyEquivalent(plan);
  const saving = annualSavingsCop(plan);
  const headingId = `plan-${plan.code}`;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article
      className={styles.card}
      data-reveal
      data-recommended={recommended || undefined}
      aria-labelledby={headingId}
    >
      <header className={styles.head}>
        <Heading id={headingId} className={styles.name}>
          {plan.name}
        </Heading>
        {recommended && <span className={styles.badge}>Recomendado</span>}
      </header>
      {/* Siempre presente, aunque el plan no tenga texto: así la fila del precio no se corre. */}
      <p className={styles.tagline}>{tagline}</p>

      <div className={styles.price}>
        {isFree ? (
          <>
            <span className={styles.amount}>Gratis</span>
            {plan.trial_days != null && (
              <span className={styles.note}>
                {plan.trial_days} días, sin tarjeta
              </span>
            )}
          </>
        ) : showsAnnual && monthly !== null ? (
          <>
            {/* El equivalente mensual va grande; el total que se paga, justo debajo. */}
            <span className={styles.amount}>
              {formatCop(monthly)}
              <span className={styles.period}> al mes</span>
            </span>
            <span className={styles.note}>
              Pagando {formatCop(plan.annual_price_cop!)} al año
              {saving !== null && `. Ahorra ${formatCop(saving)}`}
            </span>
          </>
        ) : (
          <>
            <span className={styles.amount}>
              {formatCop(plan.monthly_price_cop)}
              <span className={styles.period}> al mes</span>
            </span>
            {plan.annual_price_cop != null && (
              <span className={styles.note}>
                O {formatCop(plan.annual_price_cop)} pagando el año
              </span>
            )}
          </>
        )}
      </div>

      <ul className={styles.limits}>
        <li>
          <UsuariosIcon size={16} />
          {plan.included_users === 1
            ? "1 usuario"
            : `${plan.included_users} usuarios incluidos`}
        </li>
        {plan.extra_user_price_cop != null && (
          <li>
            <UsuarioAgregarIcon size={16} />
            {plan.max_extra_users != null
              ? `Hasta ${plan.max_extra_users} adicionales a ${formatCop(plan.extra_user_price_cop)} al mes`
              : `Usuario adicional: ${formatCop(plan.extra_user_price_cop)} al mes`}
          </li>
        )}
        <li>
          <DiscoIcon size={16} />
          {formatBytes(plan.storage_limit_bytes)} de almacenamiento
        </li>
        <li>
          <ArchivoSubirIcon size={16} />
          Archivos de hasta {formatBytes(plan.max_file_bytes)}
        </li>
      </ul>
      <div className={styles.action}>{action}</div>
    </article>
  );
}
