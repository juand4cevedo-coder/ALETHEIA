import { useState } from "react";
import { Link } from "react-router";

import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { legalRoute, ROUTES } from "../config/routes.ts";
import type { PublicPlan } from "../api/generated";
import { CONTACT_EMAIL, SIGN_UP_LABEL, SIGN_UP_NOTE } from "../config/site.ts";
import {
  PlanCatalogProvider,
  usePlanCatalog,
} from "../features/billing/catalog.tsx";
import {
  annualMonthsSaved,
  type BillingCycle,
  formatCop,
} from "../features/billing/format.ts";
import { PlanSummary } from "../features/billing/PlanSummary.tsx";
import { trialDays } from "../features/billing/plans.ts";
import { TeamSizeEstimate } from "../features/billing/TeamSizeEstimate.tsx";
import { DATA_CONTROLLER } from "../config/legal.ts";
import { type FaqItem, FaqList } from "../features/landing/FaqSection.tsx";
import { CabeceraSeo } from "../seo/CabeceraSeo.tsx";
import { PAGINAS } from "../seo/fichas.ts";
import styles from "./PricingPage.module.css";

// Página de planes y precios (UI-002, HU-002). Las tarjetas son la comparación: sus filas se
// alinean entre planes y el selector cambia todos los precios a la vez. La acción es siempre la
// misma, empezar la prueba, porque toda cuenta nueva empieza con ella sin elegir plan; por eso
// se repite debajo de las tarjetas.
export function PricingPage() {
  return (
    <PlanCatalogProvider publicado>
      <Pricing />
    </PlanCatalogProvider>
  );
}

function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { plans } = usePlanCatalog();
  const monthsSaved = plans ? annualMonthsSaved(plans) : null;
  const days = plans ? trialDays(plans) : null;

  return (
    <>
      <CabeceraSeo meta={PAGINAS.precios} />

      <section className={styles.band} aria-labelledby="titulo-precios">
        <div className={styles.inner}>
          <header className={styles.intro}>
            <h1 id="titulo-precios" className={styles.title}>
              Planes y precios
            </h1>
            <p className={styles.lead}>
              Todos los planes traen las mismas funciones: sello de tiempo,
              cadena de custodia, paquete de preservación, permisos por caso y
              portal del cliente. Solo cambian los usuarios y el almacenamiento.
            </p>
            <div className={styles.start}>
              <ButtonLink to={ROUTES.signUp}>{SIGN_UP_LABEL}</ButtonLink>
              <p className={styles.trial}>{SIGN_UP_NOTE}</p>
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

          {plans && <TeamSizeEstimate plans={plans} />}

          <div className={styles.again}>
            <ButtonLink to={ROUTES.signUp} variant="secondary">
              Empezar la prueba gratuita
            </ButtonLink>
            <p className={styles.trial}>
              {days === null
                ? "Al terminar la prueba, usted elige el plan. Nada se cobra solo."
                : `Al terminar los ${days} días, usted elige el plan. Nada se cobra solo.`}
            </p>
          </div>

          <ul className={styles.guarantees} aria-label="Condiciones de compra">
            <li>
              <strong>PSE, Nequi o tarjeta</strong>
              <span>
                Paga en la pasarela de pagos. ALETHEIA nunca ve los datos de su
                tarjeta.
              </span>
            </li>
            <li>
              <strong>Cinco días hábiles para arrepentirse</strong>
              <span>
                Después de cada pago, le devolvemos el valor completo si lo pide
                en ese plazo.
              </span>
            </li>
            <li>
              <strong>Sus casos se exportan siempre</strong>
              <span>
                Aunque cancele o un pago falle, puede ver, descargar y exportar
                lo que guardó.
              </span>
            </li>
            <li>
              <strong>Hable con quien hace ALETHEIA</strong>
              <span>
                Llame al{" "}
                <a href={DATA_CONTROLLER.phoneHref}>{DATA_CONTROLLER.phone}</a>{" "}
                o escriba a{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </span>
            </li>
          </ul>

          {/* Precio total con impuestos (Ley 1480 de 2011, art. 50, literal c). */}
          <p className={styles.taxNote}>
            Precios finales en pesos colombianos. Como el servicio lo opera una
            persona natural no responsable de IVA, no cobramos IVA ni ningún
            otro cargo. Los detalles están en los{" "}
            <Link to={legalRoute("terminos")}>términos y condiciones</Link>.
          </p>
        </div>
      </section>

      <section className={styles.faq} aria-labelledby="titulo-compra">
        <div className={`${styles.inner} ${styles.faqLayout}`}>
          <h2 id="titulo-compra" className={styles.faqTitle}>
            Preguntas antes de pagar
          </h2>
          <FaqList items={purchaseQuestions(plans, days)} />
        </div>
      </section>
    </>
  );
}

/** Usuarios incluidos y adicionales de cada plan pago, según el catálogo: «Esencial incluye 2
 * usuarios y no admite más; Profesional incluye 4 y cada persona adicional vale $19.900 al
 * mes». */
function extraUsersAnswer(plans: readonly PublicPlan[] | undefined): string {
  const paid = (plans ?? []).filter((plan) => plan.monthly_price_cop > 0);
  if (paid.length === 0) {
    return "Cada plan trae un número de usuarios incluidos, que aparece en su tarjeta. Algunos admiten usuarios adicionales con un costo mensual por persona.";
  }
  const lines = paid.map((plan) =>
    plan.extra_user_price_cop == null
      ? `${plan.name} incluye ${plan.included_users} usuarios y no admite más`
      : `${plan.name} incluye ${plan.included_users} y cada persona adicional vale ${formatCop(plan.extra_user_price_cop)} al mes`,
  );
  return `Sí. ${lines.join("; ")}. Las invitaciones abiertas también ocupan cupo, y antes de pagar ve el total con las personas de su equipo. Para más de 25 personas puede pedir una cotización del plan Corporativo.`;
}

// Cada respuesta dice lo que hace el código de cobro (services/payments.py: un plan distinto
// empieza el día del pago) o lo que fijan los términos y la política de reembolsos.
function purchaseQuestions(
  plans: readonly PublicPlan[] | undefined,
  days: number | null,
): FaqItem[] {
  return [
    {
      question: "¿Qué pasa cuando termina la prueba?",
      answer: `${days === null ? "La prueba" : `La prueba de ${days} días`} no pide tarjeta, así que nada se cobra al terminar. Si no elige un plan, la cuenta queda 30 días en solo lectura: puede ver, descargar y exportar lo que guardó. Si paga un plan, el despacho vuelve a quedar activo con los mismos casos.`,
    },
    {
      question: "¿Cómo puedo pagar?",
      answer:
        "Con PSE, Nequi o tarjeta, en la página de la pasarela de pagos. El pago lo hace la persona responsable del despacho desde Plan y facturación. El plan no se renueva solo, salvo que esa persona active la renovación automática con Nequi, que es opcional.",
    },
    {
      question: "¿Puedo cambiar de plan?",
      answer:
        "Sí, desde Plan y facturación. Al pagar un plan distinto, su periodo empieza ese día; el tiempo que quedaba del plan anterior no se descuenta ni se devuelve. Si pasa a un plan con menos almacenamiento del que usa, la cuenta queda en solo lectura hasta que libere espacio.",
    },
    {
      question: "¿Cómo cancelo y cómo funciona el retracto?",
      answer: `Puede cancelar cuando quiera desde su panel o escribiendo a ${CONTACT_EMAIL}. No se le cobra nada más y el plan sigue activo hasta el final del periodo pagado. Además, dentro de los cinco días hábiles siguientes a cada pago puede arrepentirse sin dar explicaciones: le devolvemos el valor completo en un máximo de quince días calendario.`,
    },
    {
      question: "¿Recibo factura electrónica?",
      answer: `No. El servicio lo presta una persona natural no responsable de IVA, que no está obligada a expedir factura electrónica. Con cada pago recibe un comprobante de pago numerado, por correo y en PDF desde Plan y facturación. Si su firma necesita soportar la compra, pida a ${CONTACT_EMAIL} la copia del RUT del operador.`,
    },
    {
      question: "¿Qué pasa si se llena el almacenamiento?",
      answer:
        "Se bloquean las subidas nuevas. Lo que ya guardó lo puede seguir viendo, descargando y exportando. Para volver a subir archivos, libere espacio o pase a un plan con más capacidad.",
    },
    {
      question: "¿Qué pasa con mis datos si cancelo?",
      answer:
        "Al terminar el periodo pagado, la cuenta queda en solo lectura para consultar y exportar sus casos. Cancelar no borra nada: los casos cerrados se conservan diez años en el archivo histórico. Eliminar un caso es una decisión aparte, que se pide y se confirma de forma expresa.",
    },
    {
      question: "¿Puedo agregar más usuarios?",
      answer: extraUsersAnswer(plans),
    },
  ];
}
