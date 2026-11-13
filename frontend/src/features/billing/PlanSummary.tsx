import { buttonClassName } from "../../components/ui/buttonStyles.ts";
import { usePlanCatalog } from "./catalog.tsx";
import type { BillingCycle } from "./format.ts";
import { PlanCard } from "./PlanCard.tsx";
import cards from "./PlanCard.module.css";
import {
  CORPORATE_QUOTE_URL,
  PLAN_TAGLINES,
  RECOMMENDED_PLAN,
} from "./plans.ts";
import styles from "./PlanSummary.module.css";
import { ActualizarIcon, CorreoIcon } from "../../components/ui/icons.tsx";

type PlanSummaryProps = {
  /** Forma de pago con la que se muestran los precios. */
  cycle?: BillingCycle;
  /** Nivel de los nombres de plan: 3 en una sección del inicio, 2 en la página de precios. */
  headingLevel?: 2 | 3;
};

// Planes del catálogo con la tarjeta de cada uno y, al final, el Corporativo por cotización. Lo
// usan el inicio (UI-001) y la página de precios (UI-002), así que se ven y fallan igual en los
// dos lugares. Precios y límites salen del catálogo (RN-019).
export function PlanSummary({
  cycle = "monthly",
  headingLevel = 3,
}: PlanSummaryProps) {
  const { plans, isPending, isError, isFetching, refetch } = usePlanCatalog();
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <div className={styles.wrap}>
      {isPending && (
        <div className={cards.grid} aria-busy="true">
          <p role="status" className="visually-hidden">
            Cargando los planes
          </p>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={cards.skeleton} aria-hidden="true" />
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
            className={buttonClassName({ variant: "secondary", size: "sm" })}
            onClick={refetch}
            disabled={isFetching}
          >
            <ActualizarIcon size={16} />
            {isFetching
              ? "Cargando los precios"
              : "Cargar los precios de nuevo"}
          </button>
        </div>
      )}

      {plans && (
        <div className={cards.grid}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              cycle={cycle}
              recommended={plan.code === RECOMMENDED_PLAN}
              tagline={PLAN_TAGLINES[plan.code]}
              headingLevel={headingLevel}
            />
          ))}
        </div>
      )}

      <section className={styles.corporate} aria-labelledby="plan-corporativo">
        <div className={styles.corporateCopy}>
          <Heading id="plan-corporativo" className={styles.corporateTitle}>
            Corporativo
          </Heading>
          <p>
            Para firmas grandes y departamentos jurídicos: usuarios,
            almacenamiento y soporte a la medida de su volumen, por cotización.
          </p>
        </div>
        <a
          className={buttonClassName({ variant: "secondary" })}
          href={CORPORATE_QUOTE_URL}
        >
          <CorreoIcon size={16} />
          Pedir una cotización por correo
        </a>
      </section>
    </div>
  );
}
