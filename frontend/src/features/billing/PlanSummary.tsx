import { useQuery } from "@tanstack/react-query";
import { Building2, Mail, RefreshCw } from "lucide-react";

import { listPlansOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { buttonClassName } from "../../components/ui/buttonStyles.ts";
import { PlanCard } from "./PlanCard.tsx";
import {
  CORPORATE_QUOTE_URL,
  PLAN_TAGLINES,
  RECOMMENDED_PLAN,
} from "./plans.ts";
import styles from "./PlanSummary.module.css";

// Planes del inicio (UI-001): las mismas tarjetas de la página de precios, con el precio
// mensual. Precios y límites salen del catálogo (RN-019).
export function PlanSummary() {
  const {
    data: plans,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery(listPlansOptions());

  return (
    <div className={styles.wrap}>
      {isPending && (
        <div className={styles.grid} aria-busy="true">
          <p role="status" className="visually-hidden">
            Cargando los planes…
          </p>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={styles.skeleton} aria-hidden="true" />
          ))}
        </div>
      )}

      {isError && (
        <div role="alert" className={styles.error}>
          <p>
            No pudimos cargar los precios en este momento. Intente de nuevo en
            unos segundos.
          </p>
          <button
            type="button"
            className={buttonClassName({
              surface: "dark",
              variant: "secondary",
            })}
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={16} />
            {isFetching ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
      )}

      {plans && (
        <div className={styles.grid}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              cycle="monthly"
              recommended={plan.code === RECOMMENDED_PLAN}
              tagline={PLAN_TAGLINES[plan.code]}
            />
          ))}
        </div>
      )}

      <div className={styles.corporate}>
        <span className={styles.corporateIcon}>
          <Building2 size={22} />
        </span>
        <div className={styles.corporateCopy}>
          <h3 className={styles.corporateTitle}>Corporativo</h3>
          <p>
            Para firmas grandes y departamentos jurídicos: usuarios,
            almacenamiento y soporte a la medida de su volumen, por cotización.
          </p>
        </div>
        <a
          className={buttonClassName({ surface: "dark", variant: "secondary" })}
          href={CORPORATE_QUOTE_URL}
        >
          <Mail size={16} />
          Solicitar cotización
        </a>
      </div>
    </div>
  );
}
