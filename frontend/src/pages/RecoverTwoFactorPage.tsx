import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  cancelRecoveryMutation,
  completeRecoveryMutation,
  confirmRecoveryMutation,
  requestRecoveryMutation,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { Field } from "../components/ui/Field.tsx";
import {
  CirculoVistoIcon,
  CorreoIcon,
  RelojIcon,
  VinculoIcon,
} from "../components/ui/icons.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import styles from "../features/auth/AccessScreen.module.css";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { tokenFromHash } from "../features/auth/linkToken.ts";
import {
  EMAIL_MAX_LENGTH,
  EMAIL_PATTERN,
  PASSWORD_MAX_LENGTH,
  SIGN_UP_MESSAGES,
} from "../features/auth/signUp.ts";

const TITLE_ID = "titulo-recuperar-segundo-factor";

type Stage =
  | "request"
  | "sent"
  | "confirm"
  | "waiting"
  | "cancel"
  | "canceled"
  | "complete"
  | "done"
  | "invalid";
type Problem =
  | { kind: "tooManyAttempts" }
  | { kind: "message"; text: string }
  | { kind: "system"; requestId?: string };

/** Los enlaces de los correos traen el token en el fragmento: `#t=` para confirmar y `#c=` para
 * cancelar. Se leen una vez y la dirección se limpia, para que no queden en el historial. */
function cancelTokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("c");
  return token && token.length > 0 ? token : null;
}

function colombianDate(value: string): string {
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

// Recuperar el segundo factor sin teléfono ni códigos de respaldo (ADR-053). Pedirla por
// correo, confirmarla con la contraseña, esperar 24 horas (cancelable por la persona y por los
// dueños de su despacho) y terminarla. Un enlace que ya no sirve lleva a pedir otro.
export function RecoverTwoFactorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmToken] = useState(() => tokenFromHash(location.hash));
  const [cancelToken] = useState(() => cancelTokenFromHash(location.hash));
  const [stage, setStage] = useState<Stage>(
    confirmToken ? "confirm" : cancelToken ? "cancel" : "request",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [availableAt, setAvailableAt] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (location.hash) void navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  useEffect(() => {
    if (stage !== "request" && stage !== "confirm" && stage !== "complete")
      headingRef.current?.focus();
  }, [stage]);

  function fail(failure: unknown, unauthorized: string) {
    const { status, detail, requestId } = apiProblem(failure);
    if (status === 401) {
      setError(unauthorized);
      setPassword("");
      passwordRef.current?.focus();
      return;
    }
    if (status === 429) {
      setProblem({ kind: "tooManyAttempts" });
      return;
    }
    if ((status === 404 || status === 409) && detail) {
      setProblem({ kind: "message", text: detail });
      return;
    }
    if (status === 422) {
      setError(SIGN_UP_MESSAGES.email);
      emailRef.current?.focus();
      return;
    }
    setProblem({ kind: "system", requestId });
  }

  const request = useMutation({
    ...requestRecoveryMutation(),
    onSuccess: () => setStage("sent"),
    onError: (failure) => fail(failure, ""),
  });
  const confirm = useMutation({
    ...confirmRecoveryMutation(),
    onSuccess: (data) => {
      setPassword("");
      setAvailableAt(data.available_at);
      setStage("waiting");
    },
    onError: (failure) => {
      if (apiProblem(failure).status === 400) {
        setStage("invalid");
        return;
      }
      fail(failure, "La contraseña no coincide. Vuelva a escribirla.");
    },
  });
  const cancel = useMutation({
    ...cancelRecoveryMutation(),
    onSuccess: () => setStage("canceled"),
    onError: (failure) => {
      if (apiProblem(failure).status === 400) {
        setStage("invalid");
        return;
      }
      fail(failure, "");
    },
  });
  const complete = useMutation({
    ...completeRecoveryMutation(),
    onSuccess: () => {
      setPassword("");
      setStage("done");
    },
    onError: (failure) =>
      fail(failure, "El correo o la contraseña no coinciden."),
  });

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.isPending) return;
    setProblem(null);
    const value = email.trim();
    if (value.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(value)) {
      setError(SIGN_UP_MESSAGES.email);
      emailRef.current?.focus();
      return;
    }
    setError(undefined);
    request.mutate({ body: { email: value } });
  }

  function submitConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm.isPending || !confirmToken) return;
    setProblem(null);
    if (password.length === 0) {
      setError("Escriba su contraseña.");
      passwordRef.current?.focus();
      return;
    }
    setError(undefined);
    confirm.mutate({ body: { token: confirmToken, password } });
  }

  function submitComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (complete.isPending) return;
    setProblem(null);
    const value = email.trim();
    if (value.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(value)) {
      setError(SIGN_UP_MESSAGES.email);
      emailRef.current?.focus();
      return;
    }
    if (password.length === 0) {
      setError("Escriba su contraseña.");
      passwordRef.current?.focus();
      return;
    }
    setError(undefined);
    complete.mutate({ body: { email: value, password } });
  }

  const alert = problem && (
    <div className={styles.alert} role="alert">
      {problem.kind === "tooManyAttempts" && <p>{MESSAGES.tooManyAttempts}</p>}
      {problem.kind === "message" && <p>{problem.text}</p>}
      {problem.kind === "system" && (
        <SystemError requestId={problem.requestId} />
      )}
    </div>
  );

  return (
    <>
      <title>{pageTitle("Recuperar el segundo factor")}</title>
      <meta name="robots" content="noindex" />

      <div className={styles.screen}>
        {stage === "request" && (
          <>
            <header className={styles.intro}>
              <h1 id={TITLE_ID} className={styles.title}>
                Recupere el segundo factor
              </h1>
              <p className={styles.lead}>
                Si perdió su teléfono y sus códigos de respaldo, escriba el
                correo de su cuenta y le enviaremos los pasos. Por seguridad,
                hay una espera de 24 horas y avisamos a los dueños de su
                despacho.
              </p>
            </header>
            <form
              className={styles.form}
              noValidate
              onSubmit={submitRequest}
              aria-labelledby={TITLE_ID}
            >
              {alert}
              <fieldset className={styles.fields}>
                <legend className="visually-hidden">Correo de la cuenta</legend>
                <Field
                  ref={emailRef}
                  label="Correo electrónico"
                  name="correo"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  required
                  maxLength={EMAIL_MAX_LENGTH}
                  value={email}
                  error={error}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </fieldset>
              <div className={styles.submit}>
                <Button type="submit" block busy={request.isPending}>
                  {request.isPending ? "Enviando" : "Enviarme los pasos"}
                </Button>
              </div>
              <p className={styles.lead}>
                ¿Ya confirmó el pedido y pasaron las 24 horas?{" "}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => {
                    setError(undefined);
                    setProblem(null);
                    setStage("complete");
                  }}
                >
                  Terminar la recuperación
                </button>
              </p>
            </form>
          </>
        )}

        {stage === "sent" && (
          <section className={styles.notice} aria-labelledby={TITLE_ID}>
            <CorreoIcon size={20} aria-hidden="true" />
            <h1
              id={TITLE_ID}
              className={styles.noticeTitle}
              ref={headingRef}
              tabIndex={-1}
            >
              Revise su correo
            </h1>
            <p>
              Si la cuenta existe y tiene el segundo factor activo, le enviamos
              los pasos. El enlace vence en una hora; si no le llega en unos
              minutos, revise la carpeta de spam.
            </p>
          </section>
        )}

        {stage === "confirm" && (
          <>
            <header className={styles.intro}>
              <h1 id={TITLE_ID} className={styles.title}>
                Confirme con su contraseña
              </h1>
              <p className={styles.lead}>
                Al confirmar empieza una espera de seguridad de 24 horas. Usted
                y los dueños de su despacho recibirán un aviso y podrán cancelar
                el pedido.
              </p>
            </header>
            <form
              className={styles.form}
              noValidate
              onSubmit={submitConfirm}
              aria-labelledby={TITLE_ID}
            >
              {alert}
              <fieldset className={styles.fields}>
                <legend className="visually-hidden">Contraseña</legend>
                <Field
                  ref={passwordRef}
                  label="Contraseña"
                  name="contrasena"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={password}
                  error={error}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </fieldset>
              <div className={styles.submit}>
                <Button type="submit" block busy={confirm.isPending}>
                  {confirm.isPending
                    ? "Confirmando"
                    : "Confirmar y empezar la espera"}
                </Button>
              </div>
            </form>
          </>
        )}

        {stage === "waiting" && (
          <section className={styles.notice} aria-labelledby={TITLE_ID}>
            <RelojIcon size={20} aria-hidden="true" />
            <h1
              id={TITLE_ID}
              className={styles.noticeTitle}
              ref={headingRef}
              tabIndex={-1}
            >
              La espera de seguridad empezó
            </h1>
            <p>
              Podrá terminar la recuperación a partir del{" "}
              <strong>
                {availableAt
                  ? colombianDate(availableAt)
                  : "dentro de 24 horas"}
              </strong>{" "}
              (hora de Colombia). Le enviamos un correo con un enlace para
              cancelarla si no fue usted, y avisamos a los dueños de su
              despacho.
            </p>
            <p>
              Mientras tanto, si encuentra su teléfono e ingresa con un código,
              el pedido se cancela solo.
            </p>
            <ButtonLink to={ROUTES.signIn}>Ir a ingresar</ButtonLink>
          </section>
        )}

        {stage === "cancel" && (
          <>
            <header className={styles.intro}>
              <h1 id={TITLE_ID} className={styles.title}>
                Cancelar la recuperación del segundo factor
              </h1>
              <p className={styles.lead}>
                Alguien pidió recuperar el segundo factor de una cuenta de su
                despacho. Si no fue esa persona, o no está seguro, cancele el
                pedido: el segundo factor seguirá activo, sin cambios.
              </p>
            </header>
            <div className={styles.form}>
              {alert}
              <div className={styles.submit}>
                <Button
                  type="button"
                  block
                  busy={cancel.isPending}
                  onClick={() => {
                    if (cancelToken && !cancel.isPending) {
                      setProblem(null);
                      cancel.mutate({ body: { token: cancelToken } });
                    }
                  }}
                >
                  {cancel.isPending ? "Cancelando" : "Cancelar la recuperación"}
                </Button>
              </div>
            </div>
          </>
        )}

        {stage === "canceled" && (
          <section className={styles.notice} aria-labelledby={TITLE_ID}>
            <CirculoVistoIcon size={20} aria-hidden="true" />
            <h1
              id={TITLE_ID}
              className={styles.noticeTitle}
              ref={headingRef}
              tabIndex={-1}
            >
              La recuperación se canceló
            </h1>
            <p>
              El segundo factor de la cuenta sigue activo. Avisamos a la persona
              dueña de la cuenta. Si no fue ella quien lo pidió, recomiéndele
              cambiar su contraseña.
            </p>
            <ButtonLink to={ROUTES.signIn}>Ir a ingresar</ButtonLink>
          </section>
        )}

        {stage === "complete" && (
          <>
            <header className={styles.intro}>
              <h1 id={TITLE_ID} className={styles.title}>
                Termine la recuperación
              </h1>
              <p className={styles.lead}>
                Pasadas las 24 horas, escriba su correo y su contraseña. Al
                terminar desactivamos el segundo factor y cerramos sus sesiones
                abiertas; después podrá volver a activarlo.
              </p>
            </header>
            <form
              className={styles.form}
              noValidate
              onSubmit={submitComplete}
              aria-labelledby={TITLE_ID}
            >
              {alert}
              <fieldset className={styles.fields}>
                <legend className="visually-hidden">Correo y contraseña</legend>
                <Field
                  ref={emailRef}
                  label="Correo electrónico"
                  name="correo"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  required
                  maxLength={EMAIL_MAX_LENGTH}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Field
                  ref={passwordRef}
                  label="Contraseña"
                  name="contrasena"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={password}
                  error={error}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </fieldset>
              <div className={styles.submit}>
                <Button type="submit" block busy={complete.isPending}>
                  {complete.isPending
                    ? "Terminando"
                    : "Terminar la recuperación"}
                </Button>
              </div>
            </form>
          </>
        )}

        {stage === "done" && (
          <section className={styles.notice} aria-labelledby={TITLE_ID}>
            <CirculoVistoIcon size={20} aria-hidden="true" />
            <h1
              id={TITLE_ID}
              className={styles.noticeTitle}
              ref={headingRef}
              tabIndex={-1}
            >
              Su segundo factor se recuperó
            </h1>
            <p>
              Lo desactivamos y cerramos sus sesiones abiertas. Ingrese con su
              contraseña y, desde Mi cuenta, active uno nuevo.
            </p>
            <ButtonLink to={ROUTES.signIn}>Ingresar</ButtonLink>
          </section>
        )}

        {stage === "invalid" && (
          <section className={styles.notice} aria-labelledby={TITLE_ID}>
            <VinculoIcon size={20} aria-hidden="true" />
            <h1
              id={TITLE_ID}
              className={styles.noticeTitle}
              ref={headingRef}
              tabIndex={-1}
            >
              Este enlace ya no sirve
            </h1>
            <p>
              El enlace venció, ya se usó o la recuperación ya no está abierta.
              Si necesita recuperar el segundo factor, pídala de nuevo.
            </p>
            <ButtonLink to={ROUTES.recoverTwoFactor}>
              Pedir la recuperación
            </ButtonLink>
          </section>
        )}
      </div>
    </>
  );
}
