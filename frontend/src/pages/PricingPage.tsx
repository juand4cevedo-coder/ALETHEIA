import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";

import { listPlansOptions } from "../api/generated/@tanstack/react-query.gen.ts";
import { buttonClassName } from "../components/ui/buttonStyles.ts";
import { legalRoute } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_URL, pageTitle } from "../config/site.ts";
import {
  annualMonthsSaved,
  type BillingCycle,
  formatBytes,
  formatCop,
} from "../features/billing/format.ts";
import { PlanCard } from "../features/billing/PlanCard.tsx";
import {
  CORPORATE_QUOTE_URL,
  PLAN_TAGLINES,
  RECOMMENDED_PLAN,
} from "../features/billing/plans.ts";
import styles from "./PricingPage.module.css";
import { CorreoIcon } from "../components/ui/icons.tsx";

// Página de planes y precios (UI-002, HU-002).
export function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const {
    data: plans,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery(listPlansOptions());
  const monthsSaved = plans ? annualMonthsSaved(plans) : null;

  return (
    <>
      <title>{pageTitle("Planes y precios")}</title>
      <meta
        name="description"
        content="Precios de ALETHEIA en pesos colombianos, con pago mensual o anual. Cada plan cambia en usuarios incluidos, almacenamiento y tamaño máximo por archivo."
      />
      <link rel="canonical" href={`${SITE_URL}/precios`} />

      <section className={styles.band} aria-labelledby="titulo-precios">
        <div className={styles.inner}>
          <h1 id="titulo-precios" className={styles.title}>
            Planes y precios
          </h1>
          <p className={styles.lead}>
            Todos los planes preservan la evidencia de la misma forma. Cambian
            los usuarios incluidos, el almacenamiento y el tamaño máximo de cada
            archivo.
          </p>

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
              <span>Mensual</span>
            </label>
            <label className={styles.cycleOption}>
              <input
                type="radio"
                name="ciclo"
                value="annual"
                checked={cycle === "annual"}
                onChange={() => setCycle("annual")}
              />
              <span>
                Anual
                {monthsSaved !== null && (
                  <span className={styles.saving}>
                    {monthsSaved === 1
                      ? "1 mes gratis"
                      : `${monthsSaved} meses gratis`}
                  </span>
                )}
              </span>
            </label>
          </fieldset>

          {isPending && (
            <div className={styles.grid} aria-busy="true">
              <p role="status" className="visually-hidden">
                Cargando los planes
              </p>
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className={styles.skeleton}
                  aria-hidden="true"
                />
              ))}
            </div>
          )}

          {isError && (
            <div role="alert" className={styles.error}>
              <p>
                No pudimos cargar los precios. Inténtelo de nuevo o escríbanos a{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
              <button
                type="button"
                className={styles.retry}
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching
                  ? "Cargando los precios"
                  : "Cargar los precios de nuevo"}
              </button>
            </div>
          )}

          {plans && (
            <div className={styles.grid}>
              {plans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  cycle={cycle}
                  recommended={plan.code === RECOMMENDED_PLAN}
                  tagline={PLAN_TAGLINES[plan.code]}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {plans && (
        <section className={styles.section} aria-labelledby="titulo-comparar">
          <div className={styles.inner}>
            <h2 id="titulo-comparar" className={styles.sectionTitle}>
              Compare los planes
            </h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="visually-hidden">
                  Precios y límites de cada plan
                </caption>
                <thead>
                  <tr>
                    <td />
                    {plans.map((plan) => (
                      <th key={plan.code} scope="col">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Precio mensual</th>
                    {plans.map((plan) => (
                      <td key={plan.code}>
                        {plan.monthly_price_cop === 0
                          ? "Gratis"
                          : formatCop(plan.monthly_price_cop)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Pago anual</th>
                    {plans.map((plan) => (
                      <td key={plan.code}>
                        {plan.annual_price_cop == null
                          ? "No aplica"
                          : formatCop(plan.annual_price_cop)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Usuarios incluidos</th>
                    {plans.map((plan) => (
                      <td key={plan.code}>{plan.included_users}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Usuario adicional</th>
                    {plans.map((plan) => (
                      <td key={plan.code}>
                        {plan.extra_user_price_cop == null
                          ? "No aplica"
                          : `${formatCop(plan.extra_user_price_cop)} al mes`}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Almacenamiento</th>
                    {plans.map((plan) => (
                      <td key={plan.code}>
                        {formatBytes(plan.storage_limit_bytes)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">Tamaño máximo por archivo</th>
                    {plans.map((plan) => (
                      <td key={plan.code}>
                        {formatBytes(plan.max_file_bytes)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Precio total con impuestos (Ley 1480 de 2011, art. 50, literal c). */}
            <p className={styles.taxNote}>
              Precios finales en pesos colombianos. Como el servicio lo opera
              una persona natural no responsable de IVA, no cobramos IVA ni
              ningún otro cargo. Los detalles están en los{" "}
              <Link to={legalRoute("terminos")}>términos y condiciones</Link>.
            </p>
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="titulo-corporativo">
        <div className={styles.inner}>
          <div className={styles.quote}>
            <div>
              <h2 id="titulo-corporativo" className={styles.sectionTitle}>
                ¿Una firma grande o un área jurídica?
              </h2>
              <p className={styles.quoteText}>
                El plan Corporativo se ajusta al número de usuarios y al volumen
                de su organización, y se contrata por cotización.
              </p>
            </div>
            <a className={buttonClassName()} href={CORPORATE_QUOTE_URL}>
              <CorreoIcon size={18} />
              Pedir una cotización por correo
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
