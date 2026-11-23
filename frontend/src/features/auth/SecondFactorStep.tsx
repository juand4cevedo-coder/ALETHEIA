import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";

import { signInSecondFactorMutation } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { ROUTES } from "../../config/routes.ts";
import { apiProblem } from "./apiProblem.ts";
import styles from "./AccessScreen.module.css";

const TITLE_ID = "titulo-segundo-paso";

// Segundo paso del ingreso: la contraseña (o Google) ya se comprobó y la cuenta exige el código de
// su aplicación de autenticación. Acepta también uno de los códigos de respaldo.
export function SecondFactorStep({
  onDone,
  onRestart,
}: {
  onDone: () => Promise<void> | void;
  onRestart: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const verify = useMutation({
    ...signInSecondFactorMutation(),
    onSuccess: async () => {
      setCode("");
      await onDone();
    },
    onError: (failure) => {
      const { status } = apiProblem(failure);
      setError(
        status === 429
          ? "Demasiados intentos. Espere unos minutos y vuelva a empezar."
          : "El código no es válido o el ingreso venció. Revise su aplicación y vuelva a intentarlo.",
      );
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verify.isPending) return;
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setError("Escriba el código de 6 dígitos de su aplicación.");
      return;
    }
    setError(undefined);
    verify.mutate({ body: { code: trimmed } });
  }

  return (
    <div className={styles.screen}>
      <header className={styles.intro}>
        <h1 id={TITLE_ID} className={styles.title}>
          Verificación en dos pasos
        </h1>
        <p className={styles.lead}>
          Escriba el código de 6 dígitos que muestra su aplicación de
          autenticación.
        </p>
      </header>
      <form
        className={styles.form}
        noValidate
        onSubmit={submit}
        aria-labelledby={TITLE_ID}
      >
        <fieldset className={styles.fields}>
          <legend className="visually-hidden">Código de verificación</legend>
          <Field
            label="Código"
            name="codigo"
            autoComplete="one-time-code"
            inputMode="numeric"
            spellCheck={false}
            required
            maxLength={32}
            value={code}
            error={error}
            help="Si perdió el acceso a la aplicación, escriba uno de sus códigos de respaldo."
            onChange={(event) => setCode(event.target.value)}
          />
        </fieldset>
        {verify.isError && !error && (
          <Notice tone="error">
            <p>No pudimos verificar el código.</p>
          </Notice>
        )}
        <div className={styles.submit}>
          <Button type="submit" block busy={verify.isPending}>
            {verify.isPending ? "Verificando" : "Verificar"}
          </Button>
        </div>
        <p className={styles.lead}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={onRestart}
          >
            Volver a empezar
          </button>
        </p>
        <p className={styles.lead}>
          <Link to={ROUTES.recoverTwoFactor}>
            No tengo mi teléfono ni mis códigos
          </Link>
        </p>
      </form>
    </div>
  );
}
