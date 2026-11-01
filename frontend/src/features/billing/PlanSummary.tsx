import { useQuery } from "@tanstack/react-query";

import { listPlansOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { formatBytes, formatCop } from "./format.ts";
import { CORPORATE_QUOTE_URL, RECOMMENDED_PLAN } from "./plans.ts";
import styles from "./PlanSummary.module.css";

// Resumen de planes del inicio (UI-001). Precios y límites salen del catálogo (RN-019); el
// detalle completo y el pago anual están en la página de precios.
export function PlanSummary() {
  const {
    data: plans,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery(listPlansOptions());

  if (isPending) {
    return (
      <div className={styles.grid} aria-busy="true">
        <p role="status" className="visually-hidden">
          Cargando los planes…
        </p>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={styles.skeleton} aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className={styles.error}>
        <p>
          No pudimos cargar los precios en este momento. Intente de nuevo en
          unos segundos.
        </p>
        <button
          type="button"
          className={styles.retry}
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Reintentando…" : "Reintentar"}
        </button>
      </div>
    );
  }

  return (
    <ul className={styles.grid}>
      {plans.map((plan) => {
        const recommended = plan.code === RECOMMENDED_PLAN;
        return (
          <li
            key={plan.code}
            className={
              recommended ? `${styles.card} ${styles.recommended}` : styles.card
            }
          >
            <div className={styles.head}>
              <h3 className={styles.name}>{plan.name}</h3>
              {recommended && <span className={styles.badge}>Recomendado</span>}
            </div>
            {plan.monthly_price_cop === 0 ? (
              <p className={styles.price}>
                Gratis
                {plan.trial_days != null && (
                  <span className={styles.period}>
                    {" "}
                    por {plan.trial_days} días
                  </span>
                )}
              </p>
            ) : (
              <p className={styles.price}>
                {formatCop(plan.monthly_price_cop)}
                <span className={styles.period}> al mes</span>
              </p>
            )}
            <p className={styles.limits}>
              {plan.included_users === 1
                ? "1 usuario"
                : `${plan.included_users} usuarios`}{" "}
              · {formatBytes(plan.storage_limit_bytes)}
            </p>
          </li>
        );
      })}
      <li className={`${styles.card} ${styles.corporate}`}>
        <div className={styles.head}>
          <h3 className={styles.name}>Corporativo</h3>
        </div>
        <p className={styles.price}>Por cotización</p>
        <p className={styles.limits}>
          <a href={CORPORATE_QUOTE_URL}>Solicitar cotización</a>
        </p>
      </li>
    </ul>
  );
}
