import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";

import { listPlansOptions } from "../api/generated/@tanstack/react-query.gen.ts";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { legalRoute, ROUTES } from "../config/routes.ts";
import { SIGN_UP_LABEL, SITE_URL, pageTitle } from "../config/site.ts";
import {
  annualMonthsSaved,
  type BillingCycle,
} from "../features/billing/format.ts";
import { PlanSummary } from "../features/billing/PlanSummary.tsx";
import { trialDays } from "../features/billing/plans.ts";
import styles from "./PricingPage.module.css";

// Página de planes y precios (UI-002, HU-002). Las tarjetas son la comparación: sus filas se
// alinean entre planes y el selector cambia todos los precios a la vez. Hay una sola acción
// principal, crear la cuenta, porque toda cuenta nueva empieza con la prueba sin elegir plan.
export function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { data: plans } = useQuery(listPlansOptions());
  const monthsSaved = plans ? annualMonthsSaved(plans) : null;
  const days = plans ? trialDays(plans) : null;

  return (
    <>
      <title>{pageTitle("Planes y precios")}</title>
      <meta
        name="description"
        content="Precios de ALETHEIA en pesos colombianos, con pago mensual o anual. Cada plan cambia en usuarios incluidos, almacenamiento y tamaño máximo por archivo."
      />
      <link rel="canonical" href={`${SITE_URL}${ROUTES.pricing}`} />

      <section className={styles.band} aria-labelledby="titulo-precios">
        <div className={styles.inner}>
          <header className={styles.intro}>
            <h1 id="titulo-precios" className={styles.title}>
              Planes y precios
            </h1>
            <p className={styles.lead}>
              Todos los planes preservan la evidencia de la misma forma. Cambian
              los usuarios incluidos, el almacenamiento y el tamaño máximo de
              cada archivo.
            </p>
            <div className={styles.start}>
              <ButtonLink to={ROUTES.signUp}>{SIGN_UP_LABEL}</ButtonLink>
              <p className={styles.trial}>
                {days === null
                  ? "La cuenta nueva empieza con la prueba gratuita, sin tarjeta de crédito."
                  : `La cuenta nueva empieza con ${days} días de prueba gratuita, sin tarjeta de crédito.`}
              </p>
            </div>
          </header>

          <fieldset className={styles.cycle}>
            <legend className="visually-hidden">Forma de pago</legend>
            <label className={styles.cycleOption}>
              <input
                type="radio"
                name="ciclo"
                value="monthly"
                checked={cycle === "monthly"}
                onChange={() => setCycle("monthly")}
              />
              Mensual
            </label>
            <label className={styles.cycleOption}>
              <input
                type="radio"
                name="ciclo"
                value="annual"
                checked={cycle === "annual"}
                onChange={() => setCycle("annual")}
              />
              Anual
              {monthsSaved !== null && (
                <span className={styles.saving}>
                  {monthsSaved === 1
                    ? "1 mes gratis"
                    : `${monthsSaved} meses gratis`}
                </span>
              )}
            </label>
          </fieldset>

          <PlanSummary cycle={cycle} headingLevel={2} />

          {/* Precio total con impuestos (Ley 1480 de 2011, art. 50, literal c). */}
          <p className={styles.taxNote}>
            Precios finales en pesos colombianos. Como el servicio lo opera una
            persona natural no responsable de IVA, no cobramos IVA ni ningún
            otro cargo. Los detalles están en los{" "}
            <Link to={legalRoute("terminos")}>términos y condiciones</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
