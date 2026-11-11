import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import type { ResendVerificationError } from "../../api/generated";
import { resendVerificationMutation } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { MESSAGES } from "../../content/messages.ts";
import { Field } from "../../components/ui/Field.tsx";
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN, SIGN_UP_MESSAGES } from "./signUp.ts";
import styles from "./ResendVerification.module.css";

type ResendProblem = "tooManyAttempts" | "unexpected";

function problemFrom(error: unknown): ResendProblem {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as ResendVerificationError).status
      : undefined;
  return status === 429 ? "tooManyAttempts" : "unexpected";
}

type ResendVerificationProps = {
  /** Correo de la sesión abierta. Si llega, no se vuelve a pedir: se muestra y se usa. */
  email?: string;
};

// Pide un enlace nuevo de verificación (UI-007). No lleva título propio: siempre va dentro de una
// pantalla o un diálogo que ya dice para qué sirve. Con la sesión abierta el correo ya se conoce y
// solo queda pulsar el botón. Sin sesión (la página del enlace vencido) se pide el correo, y la
// respuesta es la misma exista o no una cuenta por verificar con él, así que la pantalla tampoco
// lo revela.
export function ResendVerification({
  email: sessionEmail,
}: ResendVerificationProps) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [problem, setProblem] = useState<ResendProblem | null>(null);

  const resend = useMutation({
    ...resendVerificationMutation(),
    onError: (failure) => setProblem(problemFrom(failure)),
  });

  const email = sessionEmail ?? typed.trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resend.isPending) return;
    setProblem(null);
    if (
      sessionEmail === undefined &&
      (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email))
    ) {
      setError(SIGN_UP_MESSAGES.email);
      return;
    }
    setError(undefined);
    resend.mutate({ body: { email } });
  }

  if (resend.isSuccess) {
    return (
      <p className={styles.sent} role="status">
        {sessionEmail === undefined ? (
          <>
            Si hay una cuenta por verificar con <strong>{email}</strong>, le
            enviamos un enlace nuevo.
          </>
        ) : (
          <>
            Le enviamos un enlace nuevo a{" "}
            <strong translate="no">{email}</strong>.
          </>
        )}{" "}
        Si no lo ve en la bandeja de entrada, revise la carpeta de spam.
      </p>
    );
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={handleSubmit}
      aria-label="Pedir un enlace nuevo"
    >
      {problem && (
        <p className={styles.alert} role="alert">
          {problem === "tooManyAttempts"
            ? MESSAGES.tooManyAttempts
            : "No pudimos enviar el enlace. Inténtelo de nuevo en unos minutos."}
        </p>
      )}
      {sessionEmail === undefined ? (
        <Field
          label="Correo electrónico"
          name="correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          required
          maxLength={EMAIL_MAX_LENGTH}
          value={typed}
          error={error}
          onChange={(event) => setTyped(event.target.value)}
        />
      ) : (
        <p className={styles.destination}>
          Llegará a <strong translate="no">{sessionEmail}</strong>.
        </p>
      )}
      <Button type="submit" block busy={resend.isPending}>
        {resend.isPending ? "Enviando el enlace" : "Enviarme un enlace nuevo"}
      </Button>
    </form>
  );
}
