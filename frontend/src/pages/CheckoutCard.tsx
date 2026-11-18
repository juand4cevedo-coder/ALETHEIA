import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useId, useRef, useState } from "react";

import type { Me, PublicPlan } from "../api/generated";
import {
  createCheckoutMutation,
  wompiTermsOptions,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { apiProblem } from "../features/auth/apiProblem.ts";
import {
  PlanCatalogProvider,
  usePlanCatalog,
} from "../features/billing/catalog.tsx";
import { type BillingCycle, formatCop } from "../features/billing/format.ts";
import styles from "./CheckoutCard.module.css";

// Solo un celular colombiano (3 + 9 dígitos): la misma forma que valida el servicio
// (app/services/checkout.py), repetida aquí para que el error aparezca antes de mandar nada.
const PHONE_PATTERN = /^3\d{9}$/;

/** Tarjeta «Pagar con Nequi» (HU-027, prototipo en Administración / sección de suscripción):
 * solo se muestra cuando puede cobrar algo (prueba o periodo vencido) y la persona puede
 * administrar la facturación. El cobro se confirma por un cargo en Nequi, nunca aquí; esta
 * tarjeta solo arranca la transacción y dice qué esperar. */
export function CheckoutCard({ me }: { me: Me }) {
  const canPay =
    me.subscription != null &&
    (me.subscription.status === "trial" ||
      me.subscription.status === "expired") &&
    me.permissions.includes("billing.manage");
  if (!canPay) return null;

  return (
    <PlanCatalogProvider>
      <Checkout />
    </PlanCatalogProvider>
  );
}

type Step = "elegir" | "confirmar";

function Checkout() {
  const { plans, isPending, isError } = usePlanCatalog();
  const [step, setStep] = useState<Step>("elegir");
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string>();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPersonalAuth, setAcceptedPersonalAuth] = useState(false);
  const [started, setStarted] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const termsId = useId();

  const payable: PublicPlan[] = (plans ?? []).filter(
    (plan) => plan.monthly_price_cop > 0,
  );
  const selected = payable.find((plan) => plan.code === planCode) ?? payable[0];

  const terms = useQuery({
    ...wompiTermsOptions(),
    enabled: step === "confirmar",
  });
  const checkout = useMutation({
    ...createCheckoutMutation(),
    onSuccess: () => setStarted(true),
  });

  function goToConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!PHONE_PATTERN.test(phone)) {
      setPhoneError("Escriba un celular colombiano, como 3001234567.");
      return phoneRef.current?.focus();
    }
    setPhoneError(undefined);
    setStep("confirmar");
  }

  function confirm() {
    if (!selected || terms.data == null) return;
    checkout.mutate({
      body: {
        plan_code: selected.code,
        billing_cycle: cycle,
        phone_number: phone,
        acceptance_token: terms.data.acceptance_token,
        accept_personal_auth: terms.data.accept_personal_auth,
      },
    });
  }

  if (started) {
    return (
      <Notice tone="success">
        Enviamos el cobro a su Nequi. Abra la notificación push en su teléfono y
        apruébela para activar el plan; puede tardar unos minutos en reflejarse
        aquí.
      </Notice>
    );
  }

  if (isPending) return null;
  if (isError || payable.length === 0) {
    return (
      <Notice tone="error">
        No pudimos cargar los planes disponibles. Recargue la página.
      </Notice>
    );
  }

  if (step === "elegir") {
    return (
      <form className={styles.form} noValidate onSubmit={goToConfirm}>
        <div className={styles.field}>
          <label htmlFor="plan-checkout">Plan</label>
          <select
            id="plan-checkout"
            value={selected?.code}
            onChange={(event) => setPlanCode(event.target.value)}
          >
            {payable.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset className={styles.cycle}>
          <legend className="visually-hidden">Forma de pago</legend>
          <label>
            <input
              type="radio"
              name="ciclo-checkout"
              checked={cycle === "monthly"}
              onChange={() => setCycle("monthly")}
            />
            Mensual
            {selected && `, ${formatCop(selected.monthly_price_cop)} al mes`}
          </label>
          {selected?.annual_price_cop != null && (
            <label>
              <input
                type="radio"
                name="ciclo-checkout"
                checked={cycle === "annual"}
                onChange={() => setCycle("annual")}
              />
              Anual, {formatCop(selected.annual_price_cop)} al año
            </label>
          )}
        </fieldset>
        <Field
          ref={phoneRef}
          label="Celular Nequi"
          name="celular"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          help="A este número le llega la notificación para aprobar el cobro."
          error={phoneError}
          value={phone}
          onChange={(event) => setPhone(event.target.value.trim())}
        />
        <div className={styles.actions}>
          <Button type="submit">Continuar</Button>
        </div>
      </form>
    );
  }

  const failure = checkout.isError ? apiProblem(checkout.error) : null;

  return (
    <div className={styles.form}>
      {terms.isPending && (
        <p role="status">Cargando los contratos de la pasarela</p>
      )}
      {terms.isError && (
        <Notice tone="error">
          No pudimos cargar los contratos de Wompi. Inténtelo de nuevo.
        </Notice>
      )}
      {terms.data && (
        <>
          <label className={styles.checkboxRow} htmlFor={`${termsId}-terminos`}>
            <input
              type="checkbox"
              id={`${termsId}-terminos`}
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span>
              Acepto los{" "}
              <a
                href={terms.data.acceptance_permalink}
                target="_blank"
                rel="noreferrer"
              >
                términos de uso de Wompi
              </a>
              .
            </span>
          </label>
          <label className={styles.checkboxRow} htmlFor={`${termsId}-datos`}>
            <input
              type="checkbox"
              id={`${termsId}-datos`}
              checked={acceptedPersonalAuth}
              onChange={(event) =>
                setAcceptedPersonalAuth(event.target.checked)
              }
            />
            <span>
              Autorizo el{" "}
              <a
                href={terms.data.personal_auth_permalink}
                target="_blank"
                rel="noreferrer"
              >
                tratamiento de mis datos personales
              </a>{" "}
              por Wompi.
            </span>
          </label>
        </>
      )}
      {failure && (
        <Notice tone="error">
          {failure.status === 403 ? (
            <p>No tiene un cobro pendiente que iniciar, o no puede pagar.</p>
          ) : (
            <SystemError requestId={failure.requestId} />
          )}
        </Notice>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setStep("elegir")}>
          Volver
        </Button>
        <Button
          busy={checkout.isPending}
          disabled={!terms.data || !acceptedTerms || !acceptedPersonalAuth}
          onClick={confirm}
        >
          {checkout.isPending ? "Enviando el cobro" : "Pagar con Nequi"}
        </Button>
      </div>
    </div>
  );
}
