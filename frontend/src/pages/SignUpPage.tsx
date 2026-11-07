import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import type { RegisterAccountError } from "../api/generated";
import { registerAccountMutation } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { Checkbox } from "../components/ui/Checkbox.tsx";
import { legalRoute, ROUTES } from "../config/routes.ts";
import { SITE_NAME, SITE_URL } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import { AccountTypeChoice } from "../features/auth/AccountTypeChoice.tsx";
import { Emblem } from "../components/ui/Emblem.tsx";
import { Field } from "../components/ui/Field.tsx";
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
import styles from "../features/auth/AccessScreen.module.css";

// Por defecto, la cuenta personal: es el caso del perfil principal (PER-001).
const EMPTY: SignUpValues = {
  accountType: "individual",
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

// Crear cuenta (UI-006, HU-005): una columna sobre la escena del alba (ADR-029). Mientras la
// API responde, el anillo del emblema gira; al crearse la cuenta se cierra y el formulario da
// paso al aviso de revisar el correo (NAV-002), que es el mismo exista o no el correo.
export function SignUpPage() {
  const [values, setValues] = useState<SignUpValues>(EMPTY);
  const [errors, setErrors] = useState<SignUpErrors>({});
  // Antes del primer envío no se marcan errores mientras la persona escribe.
  const [submitted, setSubmitted] = useState(false);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const fieldRefs = useRef<
    Partial<Record<SignUpField, HTMLInputElement | null>>
  >({});
  const noticeRef = useRef<HTMLHeadingElement>(null);

  const register = useMutation({
    ...registerAccountMutation(),
    onSuccess: () => {
      setSentTo(values.email.trim());
      // La contraseña no se queda en la memoria de la página una vez enviada.
      setValues(EMPTY);
    },
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
    // Quien usa lector de pantalla escucha el aviso apenas aparece.
    if (sentTo) noticeRef.current?.focus();
  }, [sentTo]);

  function focusFirstError(found: SignUpErrors) {
    const first = SIGN_UP_FIELDS.find((field) => found[field]);
    if (first) fieldRefs.current[first]?.focus();
  }

  function bind(field: SignUpField) {
    return (input: HTMLInputElement | null) => {
      fieldRefs.current[field] = input;
    };
  }

  function update<K extends keyof SignUpValues>(
    field: K,
    value: SignUpValues[K],
  ) {
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

  const firm = values.accountType === "firm";
  const emblemState = sentTo ? "done" : register.isPending ? "working" : "idle";

  return (
    <>
      <title>{`Crear cuenta · ${SITE_NAME}`}</title>
      <meta
        name="description"
        content="Abra su cuenta de ALETHEIA y empiece la prueba gratis para preservar evidencia digital con huella, sello de tiempo y cadena de custodia."
      />
      <link rel="canonical" href={`${SITE_URL}${ROUTES.signUp}`} />

      <div className={styles.screen}>
        <header className={styles.intro}>
          <Emblem state={emblemState} />
          <h1 id={TITLE_ID} className={styles.title}>
            Cree su cuenta
          </h1>
          <p className={styles.lead}>Prueba gratis, sin tarjeta de crédito.</p>
        </header>

        {sentTo ? (
          <section className={styles.notice} aria-labelledby="titulo-aviso">
            <MailCheck size={28} aria-hidden="true" />
            <h2
              id="titulo-aviso"
              className={styles.noticeTitle}
              ref={noticeRef}
              tabIndex={-1}
            >
              Revise su correo
            </h2>
            <p>
              Si <strong>{sentTo}</strong> puede usarse, le enviamos un enlace
              para verificarlo. Ábralo para activar la cuenta y empezar la
              prueba. Si no le llega en unos minutos, revise la carpeta de spam.
            </p>
          </section>
        ) : (
          <form
            className={styles.form}
            noValidate
            onSubmit={handleSubmit}
            aria-labelledby={TITLE_ID}
          >
            {problem && (
              <div className={styles.alert} role="alert">
                <ProblemMessage problem={problem} />
              </div>
            )}

            <AccountTypeChoice
              value={values.accountType}
              onChange={(accountType) => update("accountType", accountType)}
            />

            <fieldset className={styles.fields}>
              <legend className="visually-hidden">Datos de la cuenta</legend>
              <Field
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
              {firm && (
                <div className={styles.appear}>
                  <Field
                    ref={bind("organizationName")}
                    label="Nombre de la oficina o firma"
                    name="organizacion"
                    autoComplete="organization"
                    required
                    maxLength={120}
                    value={values.organizationName}
                    error={errors.organizationName}
                    onChange={(event) =>
                      update("organizationName", event.target.value)
                    }
                  />
                </div>
              )}
              <Field
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
              <Field
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
              </Field>
            </fieldset>

            <div className={styles.terms}>
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
                . Mi contraseña se guarda como un resumen irreversible que nadie
                en ALETHEIA puede leer.
              </Checkbox>
            </div>

            <div className={styles.submit}>
              <Button
                type="submit"
                variant="bright"
                shape="pill"
                block
                busy={register.isPending}
              >
                {register.isPending ? "Creando la cuenta…" : "Crear cuenta"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
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
            página para ver la versión vigente antes de abrir la cuenta.
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
      return <p>{MESSAGES.tooManyAttempts}</p>;
    case "unexpected":
      return <SystemError requestId={problem.requestId} />;
  }
}
