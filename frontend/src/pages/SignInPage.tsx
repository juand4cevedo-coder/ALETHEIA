import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

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
import { Blank } from "../features/auth/Blank.tsx";
import { HashMatrix } from "../features/auth/HashMatrix.tsx";
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

// Ingresar (UI-008, HU-007), escrita como el acta con la que la persona se presenta. La huella
// de la derecha es la de su correo, calculada en el navegador mientras lo escribe. El mensaje
// de error es el mismo exista o no la cuenta (RN-026), y al entrar vuelve a la pantalla de /app
// que intentaba abrir (NAV-003).
export function SignInPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<SignInValues>(EMPTY);
  const [errors, setErrors] = useState<SignInErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const fieldRefs = useRef<
    Partial<Record<SignInField, HTMLInputElement | null>>
  >({});
  const alertRef = useRef<HTMLDivElement>(null);

  // Quien ya tiene sesión no necesita esta pantalla (flujo 1 del documento de Diseño).
  const session = useQuery({ ...readMeOptions(), retry: false });
  const destination = destinationAfterSignIn(
    (location.state as { from?: unknown } | null)?.from,
    ROUTES.app,
  );

  const signIn = useMutation({
    ...signInMutation(),
    onSuccess: async () => {
      // La contraseña no se queda en la memoria de la página.
      setValues((current) => ({ ...current, password: "" }));
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
          <h1 id={TITLE_ID} className={styles.title}>
            Acta de ingreso
          </h1>
          <p className={styles.lead}>
            Escriba el correo y la contraseña de su cuenta para volver a sus
            casos.
          </p>
        </header>

        <HashMatrix
          source={values.email.trim().toLowerCase()}
          sourceLabel="su correo"
        />

        <div className={styles.primary}>
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

          <form
            className={styles.form}
            noValidate
            onSubmit={handleSubmit}
            aria-labelledby={TITLE_ID}
          >
            <fieldset className={styles.clauses}>
              <legend className="visually-hidden">Datos de acceso</legend>
              <div className={styles.clause}>
                <span>Ingreso con el correo</span>
                <Blank
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
              </div>
              <div className={styles.clause}>
                <span>y la contraseña</span>
                <Blank
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
              </div>
            </fieldset>

            <Button type="submit" surface="dark" busy={signIn.isPending}>
              {signIn.isPending ? "Comprobando…" : "Ingresar"}
            </Button>
          </form>
        </div>
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
