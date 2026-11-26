import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { Me, PublicPlan } from "../api/generated";
import {
  billingQuoteOptions,
  confirmCheckoutWebMutation,
  createCheckoutMutation,
  createCheckoutWebMutation,
  listReceiptsQueryKey,
  readMeQueryKey,
  wompiTermsOptions,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Checkbox } from "../components/ui/Checkbox.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { apiProblem } from "../features/auth/apiProblem.ts";
import {
  PlanCatalogProvider,
  usePlanCatalog,
} from "../features/billing/catalog.tsx";
import { type BillingCycle, formatCop } from "../features/billing/format.ts";
import { QuoteBreakdown } from "../features/billing/QuoteBreakdown.tsx";
import { legalRoute } from "../config/routes.ts";
import { ChoiceCards } from "../components/ui/ChoiceCards.tsx";
import { Select } from "../components/ui/Select.tsx";
import styles from "./CheckoutCard.module.css";

// Solo un celular colombiano (3 + 9 dígitos): la misma forma que valida el servicio
// (app/services/checkout.py), repetida aquí para que el error aparezca antes de mandar nada.
const PHONE_PATTERN = /^3\d{9}$/;

// Cada cuánto se vuelve a preguntar por la suscripción tras mandar el cobro, y hasta cuándo:
// el push a Nequi no tiene un aviso de vuelta, así que es la única forma de notar que ya se
// aprobó sin que la persona tenga que recargar la página.
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 120_000;
const MAX_POLLS = Math.floor(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

// Wompi devuelve a la persona a esta página con el identificador de su transacción. El estado
// definitivo puede tardar (PSE y Nequi son asíncronos): se vuelve a preguntar hasta que termine.
const RETURN_POLL_MS = 5_000;
const RETURN_MAX_POLLS = 24;

type ReturnState = "checking" | "approved" | "pending" | "failed" | "error";

/** La persona vuelve del Checkout Web de Wompi: se confirma con el servidor, que le pregunta a
 * Wompi con la llave privada por el pago pendiente del despacho. La dirección de regreso solo
 * avisa que se volvió: no aporta ningún dato y nunca activa nada por sí sola. */
function CheckoutReturn({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ReturnState>("checking");
  const confirm = useMutation({
    ...confirmCheckoutWebMutation(),
    onSuccess: (result) => {
      if (result.status === "APPROVED") {
        setState("approved");
        void queryClient.invalidateQueries({ queryKey: readMeQueryKey() });
        void queryClient.invalidateQueries({
          queryKey: listReceiptsQueryKey(),
        });
      } else if (result.status === "PENDING") setState("pending");
      else setState("failed");
    },
    onError: () => setState("error"),
  });
  const { mutate } = confirm;

  useEffect(() => {
    mutate({});
  }, [mutate]);

  useEffect(() => {
    if (state !== "pending") return;
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      if (polls > RETURN_MAX_POLLS) {
        clearInterval(timer);
        return;
      }
      mutate({});
    }, RETURN_POLL_MS);
    return () => clearInterval(timer);
  }, [state, mutate]);

  if (state === "approved")
    return (
      <Notice tone="success">
        <p role="status">Su pago quedó aprobado y el plan ya está activo.</p>
      </Notice>
    );
  if (state === "failed")
    return (
      <Notice tone="error">
        <p role="alert">
          El pago no se completó: lo rechazó el banco o se canceló. No se cobró
          nada. Puede intentarlo de nuevo con otro medio de pago.
        </p>
        <Button variant="secondary" size="sm" onClick={onDone}>
          Intentar de nuevo
        </Button>
      </Notice>
    );
  if (state === "error")
    return (
      <Notice tone="warning">
        <p role="alert">
          No pudimos confirmar el pago con Wompi en este momento. Si ya pagó, el
          plan se activa solo en unos minutos; si no, inténtelo de nuevo.
        </p>
        <Button variant="secondary" size="sm" onClick={onDone}>
          Volver
        </Button>
      </Notice>
    );
  return (
    <Notice tone="info">
      <p role="status">
        {state === "pending"
          ? "Su pago está en proceso. Con PSE puede tardar unos minutos: esta página se actualiza sola."
          : "Confirmando su pago con Wompi"}
      </p>
    </Notice>
  );
}

/** Tarjeta «Pagar» (HU-027, prototipo en Administración / sección de suscripción):
 * solo se muestra cuando puede cobrar algo (prueba o periodo vencido) y la persona puede
 * administrar la facturación. El cobro se confirma por un cargo en Nequi, nunca aquí; esta
 * tarjeta solo arranca la transacción y dice qué esperar.
 *
 * El seguimiento posterior al cobro vive aquí, no en el formulario: en cuanto Nequi aprueba el
 * pago, `me.subscription.status` deja de ser "trial"/"expired" y la condición de abajo dejaría
 * de mostrar la tarjeta justo cuando más falta hace confirmar el éxito — por eso ese estado
 * sobrevive aunque la razón original para mostrar la tarjeta ya no aplique. */
export function CheckoutCard({ me }: { me: Me }) {
  const [started, setStarted] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const returnId = params.get("id");
  const active = me.subscription?.status === "active";

  // Se puede pagar en cualquier estado del plan: en la prueba o con el periodo vencido es
  // contratar; con el plan activo es renovar o cambiar de plan.
  const canPay =
    me.subscription != null && me.permissions.includes("billing.manage");

  // Nequi no avisa cuando la persona aprueba el cobro en su teléfono: hay que seguir
  // preguntando por la suscripción hasta verla activa, o avisar que se puede tardar más.
  useEffect(() => {
    if (!started || active) return;
    let polls = 0;
    const id = setInterval(() => {
      polls += 1;
      if (polls >= MAX_POLLS) {
        setPollTimedOut(true);
        clearInterval(id);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: readMeQueryKey() });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [started, active, queryClient, retryToken]);

  // Aprobado el pago, el comprobante nuevo ya existe: la lista se vuelve a pedir en lugar de seguir
  // diciendo que no hay pagos.
  useEffect(() => {
    if (started && active)
      void queryClient.invalidateQueries({ queryKey: listReceiptsQueryKey() });
  }, [started, active, queryClient]);

  function verifyAgain() {
    setPollTimedOut(false);
    void queryClient.invalidateQueries({ queryKey: readMeQueryKey() });
    setRetryToken((token) => token + 1);
  }

  if (returnId) {
    return <CheckoutReturn onDone={() => setParams({}, { replace: true })} />;
  }

  if (started) {
    if (active) {
      return (
        <Notice tone="success">
          Su pago quedó aprobado y el plan ya está activo.
        </Notice>
      );
    }
    return (
      <div className={styles.form}>
        <Notice tone="success">
          Enviamos el cobro a su Nequi. Abra la notificación push en su teléfono
          y apruébela para activar el plan; puede tardar unos minutos en
          reflejarse aquí.
        </Notice>
        {pollTimedOut && (
          <Notice tone="warning">
            <p>
              Todavía no vemos la aprobación. Revise la app de Nequi: si ya
              aprobó el cobro ahí, puede tardar un poco más en reflejarse aquí.
            </p>
            <Button variant="secondary" size="sm" onClick={verifyAgain}>
              Ya aprobé el pago, verificar de nuevo
            </Button>
          </Notice>
        )}
      </div>
    );
  }

  if (!canPay) return null;

  return (
    <PlanCatalogProvider>
      <Checkout renewing={active} onStarted={() => setStarted(true)} />
    </PlanCatalogProvider>
  );
}

// El equipo creció entre el desglose y el pago, y ya no cabe en el plan elegido.
const TEAM_CHANGED =
  "Su equipo ya no cabe en este plan. Recargue la página para ver el valor actualizado o elija un plan más amplio.";

function webFailure(status: number | undefined): string {
  if (status === 409) return TEAM_CHANGED;
  if (status === 422)
    return "No se pudo iniciar el pago. Si ya tiene uno en curso, espere a que termine o venza (una hora).";
  return "No pudimos conectar con la pasarela de pagos. Inténtelo de nuevo en un momento.";
}

type Step = "elegir" | "confirmar";
type Method = "web" | "nequi";

function Checkout({
  renewing,
  onStarted,
}: {
  renewing: boolean;
  onStarted: () => void;
}) {
  const { plans, isPending, isError } = usePlanCatalog();
  const [step, setStep] = useState<Step>("elegir");
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [method, setMethod] = useState<Method>("web");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string>();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPersonalAuth, setAcceptedPersonalAuth] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null);
  const helpId = useId();

  // Lo que vale cada plan con el equipo de hoy: el plan más los usuarios adicionales.
  const quote = useQuery({ ...billingQuoteOptions() });
  const optionFor = (code: string | undefined, forCycle: BillingCycle) =>
    quote.data?.options.find(
      (option) =>
        option.plan_code === code && option.billing_cycle === forCycle,
    );
  const fitsTeam = (plan: PublicPlan) =>
    optionFor(plan.code, "monthly")?.fits !== false;

  const payable: PublicPlan[] = (plans ?? []).filter(
    (plan) => plan.monthly_price_cop > 0,
  );
  // Sin elección todavía, el primer plan en el que cabe el equipo.
  const selected =
    payable.find((plan) => plan.code === planCode) ??
    payable.find(fitsTeam) ??
    payable[0];
  const option = optionFor(selected?.code, cycle);
  const ready = option?.fits === true;

  const terms = useQuery({
    ...wompiTermsOptions(),
    enabled: step === "confirmar",
  });
  const checkout = useMutation({
    ...createCheckoutMutation(),
    onSuccess: onStarted,
  });
  // Tarjeta, PSE y otros medios: se paga en la página de Wompi, adonde se envía a la persona.
  const web = useMutation({
    ...createCheckoutWebMutation(),
    onSuccess: (result) => window.location.assign(result.checkout_url),
  });

  // El foco entra a la confirmación al pasar de paso, como en el resto del sitio.
  useEffect(() => {
    if (step === "confirmar") confirmHeadingRef.current?.focus();
  }, [step]);

  function goToConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    if (method === "web" || renewing) {
      if (selected && !web.isPending)
        web.mutate({
          body: { plan_code: selected.code, billing_cycle: cycle },
        });
      return;
    }
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

  // Mientras llegan el catálogo y el desglose, el formulario tiene su lugar reservado: así el
  // panel de abajo no salta cuando aparece (CLS).
  if (isPending || quote.isPending)
    return <div className={styles.reserva} aria-busy="true" />;
  if (quote.isError) {
    return (
      <Notice tone="error">
        No pudimos calcular el valor con su equipo. Recargue la página.
      </Notice>
    );
  }
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
        <Select
          label="Plan"
          value={selected?.code ?? ""}
          onChange={(event) => setPlanCode(event.target.value)}
          options={payable.map((plan) => ({
            value: plan.code,
            label: fitsTeam(plan)
              ? plan.name
              : `${plan.name} (no alcanza para su equipo)`,
          }))}
        />
        <ChoiceCards
          legend="Forma de pago"
          columns={2}
          value={cycle}
          onChange={setCycle}
          options={[
            {
              value: "monthly",
              label: "Mensual",
              description: selected
                ? `${formatCop(optionFor(selected.code, "monthly")?.total_cop ?? selected.monthly_price_cop)} al mes`
                : undefined,
            },
            ...(selected?.annual_price_cop != null
              ? [
                  {
                    value: "annual" as const,
                    label: "Anual",
                    description: `${formatCop(optionFor(selected.code, "annual")?.total_cop ?? selected.annual_price_cop)} al año`,
                  },
                ]
              : []),
          ]}
        />
        {option && quote.data && (
          <QuoteBreakdown option={option} users={quote.data.users} />
        )}
        {!renewing && (
          <ChoiceCards
            legend="Medio de pago"
            columns={2}
            value={method}
            onChange={setMethod}
            options={[
              {
                value: "web",
                label: "Tarjeta, PSE u otros",
                description: "En la página segura de Wompi.",
              },
              {
                value: "nequi",
                label: "Nequi",
                description: "Con una notificación a su celular.",
              },
            ]}
          />
        )}
        {renewing && (
          <p className={styles.help}>
            Renovar el mismo plan suma el nuevo periodo al que ya tiene pagado.
            Si elige otro plan, empieza hoy. En la página de Wompi puede pagar
            con tarjeta, PSE, Nequi u otros medios.
          </p>
        )}
        {method === "web" || renewing ? (
          <p className={styles.help}>
            Lo llevaremos a la página segura de Wompi para pagar. Los datos de
            su tarjeta o de su banco los recibe Wompi; ALETHEIA nunca los ve. Al
            terminar, vuelve aquí.
          </p>
        ) : (
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
        )}
        {web.isError && (
          <Notice tone="error">
            <p role="alert">{webFailure(apiProblem(web.error).status)}</p>
          </Notice>
        )}
        <p className={styles.help}>
          Al pagar acepta los{" "}
          <Link to={legalRoute("terminos")}>términos y condiciones</Link> y la{" "}
          <Link to={legalRoute("reembolsos")}>política de reembolsos</Link>. El
          plan no se renueva solo, salvo que usted active la renovación
          automática.
        </p>
        <div className={styles.actions}>
          <Button type="submit" busy={web.isPending} disabled={!ready}>
            {method === "web" || renewing ? "Ir a pagar" : "Continuar"}
          </Button>
        </div>
      </form>
    );
  }

  const failure = checkout.isError ? apiProblem(checkout.error) : null;
  const missingAcceptance =
    terms.data != null && (!acceptedTerms || !acceptedPersonalAuth);

  return (
    <div className={styles.form}>
      <h3 ref={confirmHeadingRef} tabIndex={-1} className={styles.confirmTitle}>
        Confirme su pago
      </h3>
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
          <Checkbox
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          >
            Acepto los{" "}
            <a
              href={terms.data.acceptance_permalink}
              target="_blank"
              rel="noreferrer"
            >
              términos de uso de Wompi
            </a>
            .
          </Checkbox>
          <Checkbox
            checked={acceptedPersonalAuth}
            onChange={(event) => setAcceptedPersonalAuth(event.target.checked)}
          >
            Autorizo el{" "}
            <a
              href={terms.data.personal_auth_permalink}
              target="_blank"
              rel="noreferrer"
            >
              tratamiento de mis datos personales
            </a>{" "}
            por Wompi.
          </Checkbox>
        </>
      )}
      {option && quote.data && (
        <QuoteBreakdown option={option} users={quote.data.users} />
      )}
      {failure && (
        <Notice tone="error">
          {failure.status === 403 ? (
            <p>No tiene un cobro pendiente que iniciar, o no puede pagar.</p>
          ) : failure.status === 409 ? (
            <p>{TEAM_CHANGED}</p>
          ) : (
            <SystemError requestId={failure.requestId} />
          )}
        </Notice>
      )}
      {missingAcceptance && (
        <p id={helpId} className={styles.help}>
          Acepte los dos textos para continuar.
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setStep("elegir")}>
          Volver
        </Button>
        <Button
          busy={checkout.isPending}
          disabled={!terms.data || !acceptedTerms || !acceptedPersonalAuth}
          aria-describedby={missingAcceptance ? helpId : undefined}
          onClick={confirm}
        >
          {checkout.isPending
            ? "Enviando el cobro"
            : option
              ? `Pagar ${formatCop(option.total_cop)} con Nequi`
              : "Pagar con Nequi"}
        </Button>
      </div>
    </div>
  );
}
