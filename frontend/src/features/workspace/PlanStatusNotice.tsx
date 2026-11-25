import { useState } from "react";

import type { MySubscription } from "../../api/generated";
import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { AdvertenciaIcon, RelojIcon } from "../../components/ui/icons.tsx";
import { ROUTES } from "../../config/routes.ts";
import { formatColombiaDate } from "../cases/dates.ts";
import styles from "./PlanStatusNotice.module.css";
import { TRIAL_URGENT_DAYS, trialDaysLeft } from "./trial.ts";

function countdown(days: number): string {
  if (days === 0) return "Su prueba termina hoy";
  if (days === 1) return "Le queda 1 día de prueba";
  return `Le quedan ${days} días de prueba`;
}

type PlanStatusNoticeProps = {
  subscription: MySubscription | null | undefined;
  /** true si la persona puede pagar (permiso billing.manage). */
  canPay: boolean;
  now?: Date;
};

// Estado del plan en el inicio del espacio de trabajo, con los datos de /me (status,
// access_source y ends_at). Durante la prueba muestra la cuenta regresiva desde el primer día y
// la vuelve un aviso los últimos tres; con el plan vencido dice si venció la prueba o el plan.
// Quien no puede pagar no ve el botón: se le pide avisar a la persona responsable.
export function PlanStatusNotice({
  subscription,
  canPay,
  now,
}: PlanStatusNoticeProps) {
  // La hora se toma una vez al montar: la cuenta no cambia mientras se mira la pantalla.
  const [today] = useState(() => now ?? new Date());
  if (!subscription) return null;

  if (subscription.status === "trial" && subscription.ends_at) {
    const days = trialDaysLeft(subscription.ends_at, today);
    const urgent = days <= TRIAL_URGENT_DAYS;
    return (
      <section
        className={styles.notice}
        data-urgent={urgent || undefined}
        aria-label="Su prueba gratuita"
      >
        {urgent ? (
          <AdvertenciaIcon size={18} aria-hidden="true" />
        ) : (
          <RelojIcon size={18} aria-hidden="true" />
        )}
        <p className={styles.text}>
          <strong>{countdown(days)}.</strong>{" "}
          {days === 0
            ? "Al terminar, el despacho queda en solo lectura hasta que elija un plan."
            : `Termina el ${formatColombiaDate(subscription.ends_at)}. Nada se cobra solo.`}
        </p>
        {canPay ? (
          <ButtonLink
            to={ROUTES.billing}
            size="sm"
            variant={urgent ? "primary" : "secondary"}
          >
            Elegir un plan
          </ButtonLink>
        ) : (
          <p className={styles.aside}>
            Avise a la persona responsable del despacho para que elija un plan.
          </p>
        )}
      </section>
    );
  }

  if (subscription.status === "expired") {
    const trial = subscription.access_source === "trial";
    return (
      <section
        className={styles.notice}
        data-urgent
        aria-label={trial ? "Su prueba venció" : "Su plan venció"}
      >
        <AdvertenciaIcon size={18} aria-hidden="true" />
        <p className={styles.text}>
          <strong>
            {trial ? "Su período de prueba venció." : "Su plan venció."}
          </strong>{" "}
          El despacho está en solo lectura: puede ver, descargar y exportar lo
          que guardó.
        </p>
        {canPay ? (
          <ButtonLink to={ROUTES.billing} size="sm">
            Elegir un plan
          </ButtonLink>
        ) : (
          <p className={styles.aside}>
            Avise a la persona responsable del despacho para que elija un plan.
          </p>
        )}
      </section>
    );
  }

  return null;
}
