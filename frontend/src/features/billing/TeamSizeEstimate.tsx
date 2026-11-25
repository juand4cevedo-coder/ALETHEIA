import { useId, useState } from "react";
import { Link } from "react-router";

import type { PublicPlan } from "../../api/generated";
import { formatCop } from "./format.ts";
import { CORPORATE_QUOTE_URL, cheapestPlanFor } from "./plans.ts";
import styles from "./TeamSizeEstimate.module.css";

const MIN_PEOPLE = 1;
const MAX_PEOPLE = 200;
// Desde este tamaño, además del plan más barato, se sugiere pedir una cotización.
const CORPORATE_FROM = 25;

/** Cuánto paga al mes un despacho según cuántas personas son. Usa las mismas reglas del cobro
 * (plan más usuarios adicionales), así que el número coincide con el desglose antes de pagar. */
export function TeamSizeEstimate({ plans }: { plans: readonly PublicPlan[] }) {
  const inputId = useId();
  const [value, setValue] = useState("3");
  const people = Math.min(
    Math.max(Number.parseInt(value, 10) || MIN_PEOPLE, MIN_PEOPLE),
    MAX_PEOPLE,
  );
  const best = cheapestPlanFor(plans, people);

  return (
    <section className={styles.box} aria-labelledby={`${inputId}-titulo`}>
      <div className={styles.copy}>
        <h2 id={`${inputId}-titulo`} className={styles.title}>
          ¿Cuánto pagaría su despacho?
        </h2>
        <p>
          Escriba cuántas personas van a usar ALETHEIA, contando a quien lleva
          la cuenta. Le mostramos el plan que le sale más barato.
        </p>
      </div>
      <div className={styles.form}>
        <label htmlFor={inputId} className={styles.label}>
          Personas en el despacho
        </label>
        <input
          id={inputId}
          className={styles.input}
          type="number"
          inputMode="numeric"
          min={MIN_PEOPLE}
          max={MAX_PEOPLE}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <p className={styles.result} aria-live="polite">
          {best === null ? (
            "Para ese tamaño, pida una cotización del plan Corporativo."
          ) : (
            <>
              <strong>
                {best.plan.name}: {formatCop(best.monthly)} al mes
              </strong>
              <span>
                {best.extra === 0
                  ? `Incluye ${best.plan.included_users} usuarios.`
                  : `${best.plan.included_users} usuarios incluidos y ${best.extra} ${
                      best.extra === 1 ? "adicional" : "adicionales"
                    } a ${formatCop(best.plan.extra_user_price_cop!)} cada uno.`}
              </span>
            </>
          )}
        </p>
        {people >= CORPORATE_FROM && best !== null && (
          <p className={styles.corporate}>
            Con un equipo de este tamaño también puede{" "}
            <Link to={CORPORATE_QUOTE_URL}>pedir una cotización</Link> del plan
            Corporativo.
          </p>
        )}
      </div>
    </section>
  );
}
