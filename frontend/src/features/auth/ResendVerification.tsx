import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";

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

// Pide un enlace nuevo de verificación (UI-007). La respuesta es la misma exista o no una cuenta
// por verificar con ese correo, así que la pantalla tampoco lo revela.
export function ResendVerification() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [problem, setProblem] = useState<ResendProblem | null>(null);
  const titleId = useId();

  const resend = useMutation({
    ...resendVerificationMutation(),
    onError: (failure) => setProblem(problemFrom(failure)),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resend.isPending) return;
    setProblem(null);
    const trimmed = email.trim();
    if (trimmed.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(trimmed)) {
      setError(SIGN_UP_MESSAGES.email);
      return;
    }
    setError(undefined);
    resend.mutate({ body: { email: trimmed } });
  }

  if (resend.isSuccess) {
    return (
      <p className={styles.sent} role="status">
        Si hay una cuenta por verificar con <strong>{email.trim()}</strong>, le
        enviamos un enlace nuevo. Revise su bandeja de entrada y la carpeta de
        spam.
      </p>
    );
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className={styles.title}>
        Pida un enlace nuevo
      </h2>
      {problem && (
        <p className={styles.alert} role="alert">
          {problem === "tooManyAttempts"
            ? MESSAGES.tooManyAttempts
            : "No pudimos enviar el enlace. Inténtelo de nuevo en unos minutos."}
        </p>
      )}
      <Field
        label="Correo electrónico"
        name="correo"
        type="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        required
        maxLength={254}
        value={email}
        error={error}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" block busy={resend.isPending}>
        {resend.isPending ? "Enviando…" : "Enviarme un enlace nuevo"}
      </Button>
    </form>
  );
}
