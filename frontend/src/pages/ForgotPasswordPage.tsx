import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { forgotPasswordMutation } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { ROUTES } from "../config/routes.ts";
import { SITE_NAME, SITE_URL } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import styles from "../features/auth/AccessScreen.module.css";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { Emblem } from "../components/ui/Emblem.tsx";
import { Field } from "../components/ui/Field.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import {
  EMAIL_MAX_LENGTH,
  EMAIL_PATTERN,
  SIGN_UP_MESSAGES,
} from "../features/auth/signUp.ts";

const TITLE_ID = "titulo-recuperar";

type Problem =
  { kind: "tooManyAttempts" } | { kind: "system"; requestId?: string };

// Recuperar la contraseña (HU-010, API-011). La respuesta es la misma exista o no la cuenta
// (CA-HU-010-02), así que el aviso tampoco dice si el correo está registrado.
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLHeadingElement>(null);

  const request = useMutation({
    ...forgotPasswordMutation(),
    onSuccess: (_, variables) => setSentTo(variables.body.email),
    onError: (failure) => {
      const { status, requestId } = apiProblem(failure);
      if (status === 422) {
        setError(SIGN_UP_MESSAGES.email);
        emailRef.current?.focus();
        return;
      }
      setProblem(
        status === 429
          ? { kind: "tooManyAttempts" }
          : { kind: "system", requestId },
      );
    },
  });

  useEffect(() => {
    if (sentTo) noticeRef.current?.focus();
  }, [sentTo]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

  return (
    <>
      <title>{`Recuperar la contraseña · ${SITE_NAME}`}</title>
      <meta
        name="description"
        content="Pida un enlace para elegir una contraseña nueva en ALETHEIA."
      />
      <link rel="canonical" href={`${SITE_URL}${ROUTES.forgotPassword}`} />

      <div className={styles.screen}>
        <header className={styles.intro}>
          <Emblem state={request.isPending ? "working" : "idle"} />
          <h1 id={TITLE_ID} className={styles.title}>
            ¿Olvidó su contraseña?
          </h1>
          <p className={styles.lead}>
            Escriba el correo de su cuenta y le enviaremos un enlace para elegir
            una nueva.
          </p>
        </header>

        {sentTo ? (
          <section className={styles.notice} aria-labelledby="titulo-enviado">
            <MailCheck size={28} aria-hidden="true" />
            <h2
              id="titulo-enviado"
              className={styles.noticeTitle}
              ref={noticeRef}
              tabIndex={-1}
            >
              Revise su correo
            </h2>
            {/* MSG-003: el mismo aviso exista o no la cuenta. */}
            <p>{MESSAGES.recoveryRequested}</p>
            <p>
              Lo pidió para <strong translate="no">{sentTo}</strong>. El enlace
              vence en una hora y sirve una sola vez; si no le llega en unos
              minutos, revise la carpeta de spam.
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
                {problem.kind === "tooManyAttempts" ? (
                  <p>{MESSAGES.tooManyAttempts}</p>
                ) : (
                  <SystemError requestId={problem.requestId} />
                )}
              </div>
            )}

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
                onChange={(event) => {
                  setEmail(event.target.value);
                  // El error se va apenas el correo queda bien escrito.
                  if (error && EMAIL_PATTERN.test(event.target.value.trim())) {
                    setError(undefined);
                  }
                }}
              />
            </fieldset>

            <div className={styles.submit}>
              <Button
                type="submit"
                variant="bright"
                shape="pill"
                block
                busy={request.isPending}
              >
                {request.isPending ? "Enviando…" : "Enviarme el enlace"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
