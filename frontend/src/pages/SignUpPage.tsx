import { useMutation } from "@tanstack/react-query";
import { MailCheck, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import type { RegisterAccountError } from "../api/generated";
import { registerAccountMutation } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { Checkbox } from "../components/ui/Checkbox.tsx";
import { TextField } from "../components/ui/TextField.tsx";
import { legalRoute, ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "../config/site.ts";
import { AuthScreen } from "../features/auth/AuthScreen.tsx";
import { IntegrityPreview } from "../features/auth/IntegrityPreview.tsx";
import { PasswordMeter } from "../features/auth/PasswordMeter.tsx";
import {
  fieldErrorsFromApi,
  PASSWORD_MAX_LENGTH,
  SIGN_UP_FIELDS,
  type SignUpErrors,
  type SignUpField,
  type SignUpValues,
  toRegisterRequest,
  validateSignUp,
} from "../features/auth/signUp.ts";
import styles from "./SignUpPage.module.css";

const EMPTY: SignUpValues = {
  fullName: "",
  email: "",
  password: "",
  organizationName: "",
  acceptsLegalTerms: false,
};

const TITLE_ID = "titulo-registro";
const METER_ID = "medidor-contrasena";

type FormProblem =
  | { kind: "legalChanged" }
  | { kind: "tooManyAttempts" }
  | { kind: "unexpected"; requestId?: string };

// El cliente generado tipa el error como el cuerpo de la API, pero si la red falla llega un
// error de fetch sin status; por eso se revisa la forma antes de usarlo.
function problemFrom(error: unknown): FormProblem | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const { status, request_id: requestId } = error as RegisterAccountError;
    if (status === 409) return { kind: "legalChanged" };
    if (status === 429) return { kind: "tooManyAttempts" };
    if (status === 422) return null;
    return { kind: "unexpected", requestId };
  }
  return { kind: "unexpected" };
}

// Crear cuenta (UI-006, HU-005). Al enviarse, la página muestra el aviso de revisar el correo
// en lugar del formulario (NAV-002); el aviso es el mismo exista o no el correo.
export function SignUpPage() {
  const [values, setValues] = useState<SignUpValues>(EMPTY);
  const [errors, setErrors] = useState<SignUpErrors>({});
  // Antes del primer envío no se marcan errores mientras la persona escribe.
  const [submitted, setSubmitted] = useState(false);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const fieldRefs = useRef<
    Partial<Record<SignUpField, HTMLInputElement | null>>
  >({});
  const confirmationRef = useRef<HTMLHeadingElement>(null);

  const register = useMutation({
    ...registerAccountMutation(),
    // La contraseña no se queda en la memoria de la página una vez enviada.
    onSuccess: () => setValues((current) => ({ ...current, password: "" })),
    onError: (error) => {
      setProblem(problemFrom(error));
      if (typeof error === "object" && error !== null && "errors" in error) {
        const apiErrors = fieldErrorsFromApi(error.errors);
        setErrors(apiErrors);
        focusFirstError(apiErrors);
      }
    },
  });

  useEffect(() => {
    // Quien usa lector de pantalla escucha el aviso apenas cambia la página.
    if (register.isSuccess) confirmationRef.current?.focus();
  }, [register.isSuccess]);

  function focusFirstError(found: SignUpErrors) {
    const first = SIGN_UP_FIELDS.find((field) => found[field]);
    if (first) fieldRefs.current[first]?.focus();
  }

  function bind(field: SignUpField) {
    return (input: HTMLInputElement | null) => {
      fieldRefs.current[field] = input;
    };
  }

  function update<K extends SignUpField>(field: K, value: SignUpValues[K]) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setErrors(validateSignUp(next));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (register.isPending) return;
    setSubmitted(true);
    setProblem(null);
    const found = validateSignUp(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }
    register.mutate({ body: toRegisterRequest(values) });
  }

  const head = (
    <>
      <title>{`Crear cuenta · ${SITE_NAME}`}</title>
      <meta
        name="description"
        content="Cree su cuenta de ALETHEIA y empiece la prueba gratis para preservar evidencia digital con huella, sello de tiempo y cadena de custodia."
      />
      <link rel="canonical" href={`${SITE_URL}${ROUTES.signUp}`} />
    </>
  );

  if (register.isSuccess) {
    return (
      <AuthScreen titleId={TITLE_ID}>
        {head}
        <div className={styles.sent}>
          <span className={styles.seal} aria-hidden="true">
            <MailCheck size={32} />
          </span>
          <h1
            id={TITLE_ID}
            className={styles.title}
            ref={confirmationRef}
            tabIndex={-1}
          >
            Revise su correo
          </h1>
          <p className={styles.lead}>
            Si <strong>{values.email.trim()}</strong> puede usarse, le enviamos
            un enlace para verificarlo. Ábralo para activar la cuenta y empezar
            la prueba.
          </p>
          <p className={styles.note}>
            Si no le llega en unos minutos, revise la carpeta de spam.
          </p>
          <ButtonLink to={ROUTES.home} surface="dark" variant="secondary">
            Volver al inicio
          </ButtonLink>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      titleId={TITLE_ID}
      aside={
        <IntegrityPreview
          fullName={values.fullName}
          organizationName={values.organizationName}
        />
      }
    >
      {head}
      <div className={styles.intro}>
        <h1 id={TITLE_ID} className={styles.title}>
          Cree su cuenta
        </h1>
        <p className={styles.lead}>
          Empiece hoy la prueba gratis. No necesita tarjeta de crédito.
        </p>
      </div>

      {problem && (
        <div className={styles.alert} role="alert">
          <ProblemMessage problem={problem} />
        </div>
      )}

      <form
        className={styles.form}
        noValidate
        onSubmit={handleSubmit}
        aria-labelledby={TITLE_ID}
      >
        <TextField
          ref={bind("fullName")}
          label="Nombre completo"
          name="nombre"
          autoComplete="name"
          required
          maxLength={120}
          value={values.fullName}
          error={errors.fullName}
          onChange={(event) => update("fullName", event.target.value)}
        />
        <TextField
          ref={bind("organizationName")}
          label="Oficina o firma"
          name="organizacion"
          autoComplete="organization"
          required
          maxLength={120}
          value={values.organizationName}
          error={errors.organizationName}
          onChange={(event) => update("organizationName", event.target.value)}
        />
        <TextField
          ref={bind("email")}
          label="Correo electrónico"
          name="correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          required
          maxLength={254}
          value={values.email}
          error={errors.email}
          onChange={(event) => update("email", event.target.value)}
        />
        <TextField
          ref={bind("password")}
          label="Contraseña"
          name="contrasena"
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={values.password}
          error={errors.password}
          describedBy={METER_ID}
          onChange={(event) => update("password", event.target.value)}
        >
          <PasswordMeter id={METER_ID} password={values.password} />
        </TextField>
        <Checkbox
          ref={bind("acceptsLegalTerms")}
          name="acepta"
          required
          checked={values.acceptsLegalTerms}
          error={errors.acceptsLegalTerms}
          onChange={(event) =>
            update("acceptsLegalTerms", event.target.checked)
          }
        >
          Acepto los{" "}
          <NewTabLink to={legalRoute("terminos")}>
            términos y condiciones
          </NewTabLink>{" "}
          y autorizo el tratamiento de mis datos según la{" "}
          <NewTabLink to={legalRoute("privacidad")}>
            política de privacidad
          </NewTabLink>
          .
        </Checkbox>

        <Button type="submit" surface="dark" block busy={register.isPending}>
          {register.isPending ? "Creando la cuenta…" : "Crear cuenta"}
        </Button>
      </form>

      <p className={styles.assurance}>
        <ShieldCheck size={16} aria-hidden="true" />
        Guardamos su contraseña como un resumen irreversible: nadie en ALETHEIA
        puede leerla.
      </p>
    </AuthScreen>
  );
}

// Las políticas se abren en otra pestaña para no perder lo escrito en el formulario.
function NewTabLink({ to, children }: { to: string; children: string }) {
  return (
    <a href={to} target="_blank" rel="noopener">
      {children}
      <span className="visually-hidden"> (se abre en otra pestaña)</span>
    </a>
  );
}

function ProblemMessage({ problem }: { problem: FormProblem }) {
  switch (problem.kind) {
    case "legalChanged":
      return (
        <>
          <p>
            Los términos o la política de privacidad cambiaron. Recargue la
            página para ver la versión vigente antes de crear la cuenta.
          </p>
          <Button
            surface="dark"
            variant="secondary"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Recargar la página
          </Button>
        </>
      );
    case "tooManyAttempts":
      // MSG-004.
      return (
        <p>
          Hizo varios intentos seguidos. Espere 15 minutos e inténtelo de nuevo.
        </p>
      );
    case "unexpected":
      // MSG-019.
      return (
        <p>
          No pudimos completar la operación. Inténtelo de nuevo; si continúa,
          escríbanos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          {problem.requestId ? (
            <>
              {" "}
              con el código <code>{problem.requestId}</code>.
            </>
          ) : (
            "."
          )}
        </p>
      );
  }
}
