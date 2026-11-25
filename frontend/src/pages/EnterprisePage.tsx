import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import type { PublicPlan } from "../api/generated";
import { createSalesInquiry } from "../api/generated/sdk.gen.ts";
import { BrandMark } from "../components/ui/BrandMark.tsx";
import { Button } from "../components/ui/Button.tsx";
import { buttonClassName } from "../components/ui/buttonStyles.ts";
import { Field } from "../components/ui/Field.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { legalRoute, ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN } from "../features/auth/signUp.ts";
import {
  PlanCatalogProvider,
  usePlanCatalog,
} from "../features/billing/catalog.tsx";
import { formatBytes, formatCop } from "../features/billing/format.ts";
import { cheapestPlanFor } from "../features/billing/plans.ts";
import { DATA_CONTROLLER } from "../config/legal.ts";
import { CAPTCHA_HEADER } from "../features/captcha/captcha.ts";
import { CaptchaNotice } from "../features/captcha/CaptchaNotice.tsx";
import { useCaptcha } from "../features/captcha/useCaptcha.ts";
import { CabeceraSeo } from "../seo/CabeceraSeo.tsx";
import { PAGINAS, paginaInformativa } from "../seo/fichas.ts";
import editorial from "./EditorialPage.module.css";
import styles from "./EnterprisePage.module.css";

/** Ancla del formulario de cotización: la página de precios enlaza a /empresa#cotizar. */
export const QUOTE_ANCHOR = "cotizar";

// Lo que puede hacer cada rol, tal como lo define backend/app/core/permissions.py.
const ROLES: readonly { name: string; text: string }[] = [
  {
    name: "Responsable",
    text: "Abre la cuenta y paga el plan. Invita y retira personas, crea casos, asigna quién los trabaja e invita al cliente al portal.",
  },
  {
    name: "Administrador",
    text: "Lleva el equipo: invita, cambia roles y retira personas. En los casos a los que lo asignen, maneja tareas, notas y evidencias. No crea casos ni ve la facturación.",
  },
  {
    name: "Abogado",
    text: "Crea casos y agrega a quienes los trabajan. Sube y descarga evidencias, reparte tareas, escribe notas y publica avisos para el cliente.",
  },
  {
    name: "Asistente",
    text: "En los casos a los que lo asignen, sube evidencias, escribe notas y marca sus tareas como hechas. No descarga archivos ni crea casos.",
  },
];

export function EnterprisePage() {
  return (
    <div className={editorial.page}>
      <CabeceraSeo
        meta={paginaInformativa("empresa") ?? PAGINAS.noEncontrada}
      />
      <header className={editorial.centerHead} data-size="long">
        <div className={editorial.brandTile}>
          <BrandMark size={84} />
        </div>
        <h1>ALETHEIA para despachos con varias personas</h1>
        <p>
          Así trabaja un despacho de cinco personas en ALETHEIA: quién entra,
          qué ve cada uno, qué ve el cliente y cuánto se paga.
        </p>
        <a
          href={`#${QUOTE_ANCHOR}`}
          className={`${buttonClassName()} ${styles.lead}`}
        >
          Cuéntenos cómo trabaja su despacho
        </a>
      </header>

      <PlanCatalogProvider publicado>
        <div className={styles.body}>
          <section className={styles.block} aria-labelledby="escenario">
            <h2 id="escenario">Un despacho de ejemplo</h2>
            <p>
              Piense en una oficina de derecho laboral: una socia que lleva el
              despacho, una administradora, dos abogados y un asistente que
              organiza los archivos. La socia abre la cuenta e invita a los
              demás por correo. Cada invitación sirve una vez y vence a las 72
              horas; quien la acepta entra con su propio correo y su propia
              contraseña.
            </p>
          </section>

          <section className={styles.block} aria-labelledby="roles">
            <h2 id="roles">Qué puede hacer cada rol</h2>
            <ul className={styles.roles}>
              {ROLES.map((role) => (
                <li key={role.name}>
                  <h3>{role.name}</h3>
                  <p>{role.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.block} aria-labelledby="casos">
            <h2 id="casos">Quién ve cada caso</h2>
            <p>
              Quien crea un caso queda asignado a él y agrega a las personas que
              lo van a llevar. Los demás miembros del despacho no lo ven en su
              lista ni pueden abrirlo. Si el asistente apoya solo dos de los
              casos de la socia, solo ve esos dos, y en ellos puede subir la
              evidencia que llegó por correo sin poder descargar los originales.
            </p>
          </section>

          <section className={styles.block} aria-labelledby="portal">
            <h2 id="portal">El cliente ve lo que usted le publica</h2>
            <p>
              Desde el caso, el abogado invita al cliente con su correo. El
              cliente no necesita cuenta: abre un enlace personal que vence a
              los 30 días y se puede renovar, acepta un aviso sobre sus datos y
              ve el título y el estado de su caso, los avisos que el despacho
              publicó y los documentos que el abogado subió para él. También
              puede escribirle al despacho. Las notas, las tareas y las
              evidencias del expediente no llegan al portal.
            </p>
          </section>

          <Pricing />

          <QuoteForm />
        </div>
      </PlanCatalogProvider>
    </div>
  );
}

function plan(plans: PublicPlan[] | undefined, code: string) {
  return plans?.find((item) => item.code === code);
}

// El despacho del ejemplo: la socia, la administradora, dos abogados y el asistente.
const EXAMPLE_TEAM = 5;

/** Desde cuántas personas el plan más barato pasa a ser `code`, o null si nunca. */
function smallestTeamFor(plans: PublicPlan[], code: string): number | null {
  for (let people = 1; people <= 100; people += 1) {
    if (cheapestPlanFor(plans, people)?.plan.code === code) return people;
  }
  return null;
}

/** Lo que paga el despacho del ejemplo, con los precios del catálogo. */
function Pricing() {
  const { plans, isError } = usePlanCatalog();
  const example = plans ? cheapestPlanFor(plans, EXAMPLE_TEAM) : null;
  const firm = plan(plans, "firm");
  const firmFrom = plans ? smallestTeamFor(plans, "firm") : null;

  return (
    <section className={styles.block} aria-labelledby="precio">
      <h2 id="precio">Cuánto paga el despacho del ejemplo</h2>
      {example ? (
        <>
          <p>
            Para cinco personas, el plan que sale más barato es{" "}
            {example.plan.name}: incluye {example.plan.included_users} usuarios
            y {formatBytes(example.plan.storage_limit_bytes)} para evidencias
            {example.plan.extra_user_price_cop != null &&
              `, y cada persona de más cuesta ${formatCop(example.plan.extra_user_price_cop)} al mes`}
            . Cuentan los miembros del despacho y las invitaciones que siguen
            abiertas.
          </p>
          <TeamExample plan={example.plan} people={EXAMPLE_TEAM} />
          {firm && firmFrom !== null && firm.extra_user_price_cop != null && (
            <p>
              Desde {firmFrom} personas conviene el plan Firma: cuesta{" "}
              {formatCop(firm.monthly_price_cop)} al mes, incluye{" "}
              {firm.included_users} usuarios y{" "}
              {formatBytes(firm.storage_limit_bytes)}, y cada persona de más
              cuesta {formatCop(firm.extra_user_price_cop)} al mes.
            </p>
          )}
          <p>
            En el pago anual, el plan y cada usuario adicional valen diez meses.
            Antes de pagar, Plan y facturación muestra el desglose con su equipo
            de ese día.{" "}
            <Link to={ROUTES.pricing}>Calcule el precio para su despacho</Link>
          </p>
        </>
      ) : (
        <p>
          {isError
            ? "No pudimos cargar los precios en este momento. "
            : "Cargando los precios. "}
          <Link to={ROUTES.pricing}>Ver todos los planes</Link>
        </p>
      )}
      <p>
        Si su equipo es más grande, tiene varias sedes o necesita condiciones
        propias, el plan Corporativo se cotiza. Cuéntenos cómo trabajan en el
        formulario de abajo.
      </p>
    </section>
  );
}

function TeamExample({ plan, people }: { plan: PublicPlan; people: number }) {
  const extra = Math.max(people - plan.included_users, 0);
  const unit = plan.extra_user_price_cop ?? 0;
  return (
    <dl
      className={styles.example}
      aria-label={`Un despacho de ${people} personas en el plan ${plan.name}`}
    >
      <div>
        <dt>
          Plan {plan.name}, {plan.included_users} usuarios
        </dt>
        <dd>{formatCop(plan.monthly_price_cop)}</dd>
      </div>
      {extra > 0 && (
        <div>
          <dt>
            {extra === 1
              ? `1 usuario adicional a ${formatCop(unit)}`
              : `${extra} usuarios adicionales a ${formatCop(unit)}`}
          </dt>
          <dd>{formatCop(extra * unit)}</dd>
        </div>
      )}
      <div className={styles.exampleTotal}>
        <dt>Un despacho de {people} personas, al mes</dt>
        <dd>{formatCop(plan.monthly_price_cop + extra * unit)}</dd>
      </div>
    </dl>
  );
}

type Errors = Partial<
  Record<"name" | "organization" | "email" | "users", string>
>;
type Problem =
  | { kind: "tooMany" }
  | { kind: "captcha" }
  | { kind: "system"; requestId?: string };

const USERS_MAX = 10_000;

function validate(values: {
  name: string;
  organization: string;
  email: string;
  users: string;
}): Errors {
  const errors: Errors = {};
  if (values.name.trim().length < 2) errors.name = "Escriba su nombre.";
  if (values.organization.trim().length < 2)
    errors.organization = "Escriba el nombre de la firma u oficina.";
  const email = values.email.trim();
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email))
    errors.email = "Escriba un correo como nombre@firma.com.";
  const users = Number(values.users);
  if (!Number.isInteger(users) || users < 1 || users > USERS_MAX)
    errors.users = "Escriba un número entre 1 y 10.000.";
  return errors;
}

/** Formulario de cotización del plan Corporativo (POST /api/v1/sales-inquiries). */
function QuoteForm() {
  const [values, setValues] = useState({
    name: "",
    organization: "",
    email: "",
    users: "",
    message: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ filing: string; email: string } | null>(
    null,
  );
  const captcha = useCaptcha();
  const doneRef = useRef<HTMLHeadingElement>(null);
  const noticeId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const organizationRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const usersRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  function update(field: keyof typeof values) {
    return (event: { target: { value: string } }) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      if (field !== "message" && errors[field])
        setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setProblem(null);
    const found = validate(values);
    setErrors(found);
    const first = (["name", "organization", "email", "users"] as const).find(
      (field) => found[field],
    );
    if (first) {
      const target = {
        name: nameRef,
        organization: organizationRef,
        email: emailRef,
        users: usersRef,
      }[first];
      target.current?.focus();
      return;
    }
    setSending(true);
    try {
      const token = await captcha.take();
      const { data } = await createSalesInquiry({
        body: {
          name: values.name.trim(),
          organization: values.organization.trim(),
          email: values.email.trim(),
          users: Number(values.users),
          message: values.message.trim() || null,
        },
        headers: { [CAPTCHA_HEADER]: token },
        throwOnError: true,
      });
      setSent({ filing: data.filing_number, email: values.email.trim() });
    } catch (failure) {
      const { status, requestId } = apiProblem(failure);
      setProblem(
        status === 429
          ? { kind: "tooMany" }
          : status === 400
            ? { kind: "captcha" }
            : { kind: "system", requestId },
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      id={QUOTE_ANCHOR}
      className={styles.quote}
      aria-labelledby="titulo-cotizar"
    >
      <h2 id="titulo-cotizar">Pida una cotización</h2>
      {sent ? (
        <div className={styles.done}>
          <h3 ref={doneRef} tabIndex={-1}>
            Recibimos su solicitud
          </h3>
          <p>
            Quedó con el radicado <strong translate="no">{sent.filing}</strong>.
            Le escribiremos a <strong translate="no">{sent.email}</strong> con
            la propuesta o con las preguntas que tengamos.
          </p>
        </div>
      ) : (
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => void submit(event)}
          aria-labelledby="titulo-cotizar"
          aria-describedby={noticeId}
        >
          <p className={styles.intro}>
            Cuéntenos cuántas personas son y cómo se reparten el trabajo. Le
            respondemos por correo con una propuesta o con preguntas. Si
            prefiere hablar, llame al{" "}
            <a href={DATA_CONTROLLER.phoneHref}>{DATA_CONTROLLER.phone}</a>.
          </p>
          {problem && (
            <div className={styles.alert} role="alert">
              {problem.kind === "tooMany" && <p>{MESSAGES.tooManyAttempts}</p>}
              {problem.kind === "captcha" && (
                <p>
                  No pudimos comprobar que es una persona. Espere a que termine
                  la verificación e inténtelo de nuevo.
                </p>
              )}
              {problem.kind === "system" && (
                <SystemError requestId={problem.requestId} />
              )}
            </div>
          )}
          <div className={styles.grid}>
            <Field
              ref={nameRef}
              label="Nombre"
              name="nombre"
              autoComplete="name"
              required
              maxLength={120}
              value={values.name}
              error={errors.name}
              onChange={update("name")}
            />
            <Field
              ref={organizationRef}
              label="Firma u oficina"
              name="firma"
              autoComplete="organization"
              required
              maxLength={120}
              value={values.organization}
              error={errors.organization}
              onChange={update("organization")}
            />
            <Field
              ref={emailRef}
              label="Correo"
              name="correo"
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              required
              maxLength={EMAIL_MAX_LENGTH}
              value={values.email}
              error={errors.email}
              onChange={update("email")}
            />
            <Field
              ref={usersRef}
              label="Número aproximado de usuarios"
              name="usuarios"
              inputMode="numeric"
              required
              maxLength={5}
              value={values.users}
              error={errors.users}
              onChange={update("users")}
            />
          </div>
          <Field
            label="Mensaje (opcional)"
            name="mensaje"
            multiline
            rows={4}
            maxLength={2000}
            help="Por ejemplo: cuántas sedes tienen, qué áreas atienden o qué necesitan del portal del cliente."
            value={values.message}
            onChange={update("message")}
          />
          <p id={noticeId} className={styles.privacy}>
            Usamos estos datos solo para responder su solicitud y preparar la
            cotización. El responsable del tratamiento es Juan Diego Acevedo
            Calderón. Puede consultarlos, corregirlos o pedir que los borremos
            escribiendo a {CONTACT_EMAIL}. Al enviar el formulario autoriza ese
            uso, según la{" "}
            <Link to={legalRoute("privacidad")}>
              política de tratamiento de datos
            </Link>
            .
          </p>
          <div className={styles.submit}>
            <Button type="submit" busy={sending || captcha.waiting}>
              {sending ? "Enviando la solicitud" : "Pedir la cotización"}
            </Button>
            <CaptchaNotice status={captcha.status} onRetry={captcha.retry} />
          </div>
        </form>
      )}
    </section>
  );
}
