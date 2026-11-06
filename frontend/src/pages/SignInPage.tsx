import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";

import type { SignInError } from "../api/generated";
import {
  readMeOptions,
  readMeQueryKey,
  signInMutation,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "../config/site.ts";
import styles from "../features/auth/AccessScreen.module.css";
import { Emblem } from "../features/auth/Emblem.tsx";
import { Field } from "../features/auth/Field.tsx";
import { signedOutScope } from "../features/session/useSignOut.ts";
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
// Lo que tarda el anillo del emblema en cerrarse antes de pasar al espacio de trabajo.
const SEAL_MS = 520;

function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true
  );
}

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

const SIGNED_OUT_MESSAGES = {
  device: "Cerró la sesión en este dispositivo.",
  everywhere:
    "Cerró la sesión en todos sus dispositivos. Para seguir, ingrese de nuevo.",
} as const;

// Ingresar (UI-008, HU-007): una columna sobre la escena del alba (ADR-029). Mientras la API
// responde, el anillo del emblema gira; al entrar se cierra y lleva a la pantalla de /app que
// la persona intentaba abrir (NAV-003). El mensaje de error es el mismo exista o no la cuenta
// (RN-026).
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

  // Quien ya tiene sesión no necesita esta pantalla (flujo 1 del documento de Diseño).
  const session = useQuery({ ...readMeOptions(), retry: false });
  // Quien acaba de cerrar la sesión recibe la confirmación aquí (HU-009).
  const signedOut = signedOutScope(location.state);
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
      await queryClient.invalidateQueries({ queryKey: readMeQueryKey() });
      if (!prefersReducedMotion()) {
        await new Promise((resolve) => window.setTimeout(resolve, SEAL_MS));
      }
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

  if (session.isSuccess) {
    return <Navigate to={destination} replace />;
  }

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

  const emblemState = signedIn ? "done" : signIn.isPending ? "working" : "idle";

  return (
    <>
      <title>{`Ingresar · ${SITE_NAME}`}</title>
      <meta
        name="description"
        content="Ingrese a ALETHEIA con su correo y su contraseña para trabajar en sus casos."
      />
      <link rel="canonical" href={`${SITE_URL}${ROUTES.signIn}`} />

      <div className={styles.screen}>
        <header className={styles.intro}>
          <Emblem state={emblemState} />
          <h1 id={TITLE_ID} className={styles.title}>
            Qué bueno verle de nuevo
          </h1>
          <p className={styles.lead}>
            Ingrese con el correo y la contraseña de su cuenta.
          </p>
        </header>

        <form
          className={styles.form}
          noValidate
          onSubmit={handleSubmit}
          aria-labelledby={TITLE_ID}
        >
          {signedOut && !problem && (
            <p className={styles.signedOut} role="status">
              <CircleCheck size={18} aria-hidden="true" />
              {SIGNED_OUT_MESSAGES[signedOut]}
            </p>
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
            <Button
              type="submit"
              variant="bright"
              shape="pill"
              block
              busy={signIn.isPending || signedIn}
            >
              {signIn.isPending || signedIn ? "Comprobando…" : "Ingresar"}
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
            `Esta cuenta está bloqueada. Escríbanos a ${CONTACT_EMAIL}.`}
        </p>
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
