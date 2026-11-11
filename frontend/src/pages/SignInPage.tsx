import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import type { SignInError } from "../api/generated";
import {
  readMeQueryKey,
  signInMutation,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_URL, pageTitle } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import styles from "../features/auth/AccessScreen.module.css";
import { Field } from "../components/ui/Field.tsx";
import { rememberSession } from "../features/session/sessionHint.ts";
import { sessionNotice } from "../features/session/useSignOut.ts";
import {
  destinationAfterSignIn,
  SIGN_IN_FIELDS,
  SIGN_IN_MESSAGES,
  type SignInErrors,
  type SignInField,
  type SignInValues,
  toLoginRequest,
  validateSignIn,
} from "../features/auth/signIn.ts";

const EMPTY: SignInValues = { email: "", password: "" };
const TITLE_ID = "titulo-ingreso";

type FormProblem =
  | { kind: "invalidCredentials" }
  | { kind: "blocked"; detail?: string }
  | { kind: "tooManyAttempts" }
  | { kind: "unexpected"; requestId?: string };

// Igual que en el registro: si la red falla, el error no trae status y se revisa la forma.
function problemFrom(error: unknown): FormProblem | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const {
      status,
      detail,
      request_id: requestId,
    } = error as SignInError & { detail?: string };
    if (status === 401) return { kind: "invalidCredentials" };
    if (status === 403) return { kind: "blocked", detail };
    if (status === 429) return { kind: "tooManyAttempts" };
    if (status === 422) return null;
    return { kind: "unexpected", requestId };
  }
  return { kind: "unexpected" };
}

const SESSION_NOTICES = {
  device: "Cerró la sesión en este dispositivo.",
  everywhere:
    "Cerró la sesión en todos sus dispositivos. Para seguir, ingrese de nuevo.",
  expired: MESSAGES.sessionExpired,
} as const;

// Ingresar (UI-008, HU-007): un panel en la columna de acceso (ADR-029). Mientras la API
// responde, el botón dice que trabaja; al entrar lleva a la pantalla de /app que la persona
// intentaba abrir (NAV-003). El mensaje de error es el mismo exista o no la cuenta (RN-026).
export function SignInPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<SignInValues>(EMPTY);
  const [errors, setErrors] = useState<SignInErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const fieldRefs = useRef<
    Partial<Record<SignInField, HTMLInputElement | null>>
  >({});
  const alertRef = useRef<HTMLDivElement>(null);

  // Quien acaba de cerrar la sesión o cuya sesión venció recibe el aviso aquí (HU-009).
  const notice = sessionNotice(location.state);
  const destination = destinationAfterSignIn(
    (location.state as { from?: unknown } | null)?.from,
    ROUTES.app,
  );

  const signIn = useMutation({
    ...signInMutation(),
    onSuccess: async () => {
      // La contraseña no se queda en la memoria de la página.
      setValues((current) => ({ ...current, password: "" }));
      setSignedIn(true);
      rememberSession();
      await queryClient.invalidateQueries({ queryKey: readMeQueryKey() });
      await navigate(destination, { replace: true });
    },
    onError: (error) => {
      const found = problemFrom(error);
      setProblem(found);
      if (found?.kind === "invalidCredentials") {
        // Se conserva el correo y se pide de nuevo la contraseña, que es lo que suele fallar.
        setValues((current) => ({ ...current, password: "" }));
        fieldRefs.current.password?.focus();
        return;
      }
      if (found) {
        alertRef.current?.focus();
        return;
      }
      if (typeof error === "object" && error !== null && "errors" in error) {
        const apiErrors = fieldErrorsFromApi(error.errors);
        setErrors(apiErrors);
        focusFirstError(apiErrors);
      }
    },
  });

  function focusFirstError(found: SignInErrors) {
    const first = SIGN_IN_FIELDS.find((field) => found[field]);
    if (first) fieldRefs.current[first]?.focus();
  }

  function bind(field: SignInField) {
    return (input: HTMLInputElement | null) => {
      fieldRefs.current[field] = input;
    };
  }

  function update(field: SignInField, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setErrors(validateSignIn(next));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signIn.isPending) return;
    setSubmitted(true);
    setProblem(null);
    const found = validateSignIn(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }
    signIn.mutate({ body: toLoginRequest(values) });
  }

  return (
    <>
      <title>{pageTitle("Ingresar")}</title>
      <meta
        name="description"
        content="Ingrese a ALETHEIA con su correo y su contraseña para trabajar en sus casos."
      />
      <link rel="canonical" href={`${SITE_URL}${ROUTES.signIn}`} />

      <div className={styles.screen}>
        <header className={styles.intro}>
          <h1 id={TITLE_ID} className={styles.title}>
            Ingrese a su cuenta
          </h1>
          <p className={styles.lead}>
            Use el correo y la contraseña de su cuenta.
          </p>
        </header>

        <form
          className={styles.form}
          noValidate
          onSubmit={handleSubmit}
          aria-labelledby={TITLE_ID}
        >
          {notice && !problem && (
            <Notice tone={notice === "expired" ? "info" : "success"}>
              {SESSION_NOTICES[notice]}
            </Notice>
          )}

          {problem && (
            <div
              ref={alertRef}
              className={styles.alert}
              role="alert"
              tabIndex={-1}
            >
              <ProblemMessage problem={problem} />
            </div>
          )}

          <fieldset className={styles.fields}>
            <legend className="visually-hidden">Datos de acceso</legend>
            <Field
              ref={bind("email")}
              label="Correo electrónico"
              name="correo"
              type="email"
              autoComplete="username"
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
              autoComplete="current-password"
              required
              value={values.password}
              error={errors.password}
              onChange={(event) => update("password", event.target.value)}
            />
            <Link to={ROUTES.forgotPassword} className={styles.forgot}>
              ¿Olvidó su contraseña?
            </Link>
          </fieldset>

          <div className={styles.submit}>
            <Button type="submit" block busy={signIn.isPending || signedIn}>
              {signIn.isPending || signedIn ? "Ingresando" : "Ingresar"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

// Campo del formulario al que corresponde cada campo de la API, para mostrar ahí un 422.
function fieldErrorsFromApi(
  errors: ReadonlyArray<{ loc: ReadonlyArray<string | number> }>,
): SignInErrors {
  const result: SignInErrors = {};
  for (const error of errors) {
    const field = String(error.loc.at(-1));
    if (field === "email" || field === "password") {
      result[field] = SIGN_IN_MESSAGES[field];
    }
  }
  return result;
}

function ProblemMessage({ problem }: { problem: FormProblem }) {
  switch (problem.kind) {
    case "invalidCredentials":
      return <p>{SIGN_IN_MESSAGES.invalidCredentials}</p>;
    case "blocked":
      return (
        <p>
          {problem.detail ??
            `Esta cuenta está bloqueada. Para saber por qué y cómo desbloquearla, escríbanos a ${CONTACT_EMAIL}.`}
        </p>
      );
    case "tooManyAttempts":
      return <p>{MESSAGES.tooManyAttempts}</p>;
    case "unexpected":
      return <SystemError requestId={problem.requestId} />;
  }
}
