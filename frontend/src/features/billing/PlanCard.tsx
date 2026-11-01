import {
  ArrowRight,
  FileUp,
  HardDrive,
  UserPlus,
  UsersRound,
} from "lucide-react";

import { ButtonLink } from "../../components/ui/ButtonLink.tsx";

import type { PublicPlan } from "../../api/generated";
import { ROUTES } from "../../config/routes.ts";
import {
  annualMonthsCharged,
  type BillingCycle,
  formatBytes,
  formatCop,
} from "./format.ts";
import styles from "./PlanCard.module.css";

type PlanCardProps = {
  plan: PublicPlan;
  cycle: BillingCycle;
  recommended?: boolean;
  tagline?: string;
};

// Tarjeta de plan (CMP-UI-012). Todos los precios y límites vienen del catálogo (RN-019).
export function PlanCard({
  plan,
  cycle,
  recommended = false,
  tagline,
}: PlanCardProps) {
  const isFree = plan.monthly_price_cop === 0;
  const showsAnnual = cycle === "annual" && plan.annual_price_cop != null;
  const months = annualMonthsCharged(plan);
  const headingId = `plan-${plan.code}`;

  const signupUrl = isFree
    ? `${ROUTES.signUp}?plan=${plan.code}`
    : `${ROUTES.signUp}?plan=${plan.code}&ciclo=${cycle === "annual" ? "anual" : "mensual"}`;

  return (
    <article
      className={
        recommended ? `${styles.card} ${styles.recommended}` : styles.card
      }
      aria-labelledby={headingId}
    >
      <header className={styles.head}>
        <h3 id={headingId} className={styles.name}>
          {plan.name}
        </h3>
        {recommended && <span className={styles.badge}>Recomendado</span>}
      </header>
      {tagline && <p className={styles.tagline}>{tagline}</p>}

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
        ) : showsAnnual ? (
          <>
            <span className={styles.amount}>
              {formatCop(plan.annual_price_cop!)}
              <span className={styles.period}>/año</span>
            </span>
            {months !== null && (
              <span className={styles.note}>El valor de {months} meses</span>
            )}
          </>
        ) : (
          <>
            <span className={styles.amount}>
              {formatCop(plan.monthly_price_cop)}
              <span className={styles.period}>/mes</span>
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
          <UsersRound size={16} />
          {plan.included_users === 1
            ? "1 usuario"
            : `${plan.included_users} usuarios incluidos`}
        </li>
        {plan.extra_user_price_cop != null && (
          <li>
            <UserPlus size={16} />
            Usuario adicional: {formatCop(plan.extra_user_price_cop)} al mes
          </li>
        )}
        <li>
          <HardDrive size={16} />
          {formatBytes(plan.storage_limit_bytes)} de almacenamiento
        </li>
        <li>
          <FileUp size={16} />
          Archivos de hasta {formatBytes(plan.max_file_bytes)}
        </li>
      </ul>

      <ButtonLink
        to={signupUrl}
        surface="dark"
        variant={recommended ? "primary" : "secondary"}
        aria-describedby={headingId}
      >
        {isFree ? "Empezar la prueba" : `Elegir ${plan.name}`}
        <ArrowRight size={16} />
      </ButtonLink>
    </article>
  );
}
