import { useMutation } from "@tanstack/react-query";
import { CircleCheck, LinkIcon } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { resetPasswordMutation } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_NAME } from "../config/site.ts";
import styles from "../features/auth/AccessScreen.module.css";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { Emblem } from "../features/auth/Emblem.tsx";
import { Field } from "../features/auth/Field.tsx";
import { tokenFromHash } from "../features/auth/linkToken.ts";
import { newPasswordError } from "../features/auth/newPassword.ts";
import { PasswordMeter } from "../features/auth/PasswordMeter.tsx";
import { PASSWORD_MAX_LENGTH } from "../features/auth/signUp.ts";

const TITLE_ID = "titulo-restablecer";
const METER_ID = "medidor-restablecer";

type Stage = "form" | "done" | "invalid";
type Problem = "tooManyAttempts" | "unexpected";

// Elegir una contraseña nueva con el enlace del correo (HU-010, API-012). El token sale de la
// dirección apenas se lee, para que no quede en el historial. Un enlace que ya no sirve lleva
// a pedir otro; al terminar, todas las sesiones quedan cerradas y se ingresa de nuevo.
export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => tokenFromHash(location.hash));
  const [stage, setStage] = useState<Stage>(token ? "form" : "invalid");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (location.hash) {
      void navigate(location.pathname, { replace: true });
    }
  }, [location.hash, location.pathname, navigate]);

  useEffect(() => {
    if (stage !== "form") headingRef.current?.focus();
  }, [stage]);

  const reset = useMutation({
    ...resetPasswordMutation(),
    onSuccess: () => {
      // La contraseña no se queda en la memoria de la página.
      setPassword("");
      setStage("done");
    },
    onError: (failure) => {
      const { status } = apiProblem(failure);
      if (status === 400) {
        setStage("invalid");
        return;
      }
      setProblem(status === 429 ? "tooManyAttempts" : "unexpected");
    },
  });

  const error = submitted ? newPasswordError(password) : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reset.isPending || !token) return;
    setSubmitted(true);
    setProblem(null);
    if (newPasswordError(password)) {
      passwordRef.current?.focus();
      return;
    }
    reset.mutate({ body: { token, password } });
  }

  return (
    <>
      <title>{`Elegir una contraseña nueva · ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex" />

      <div className={styles.screen}>
        {stage === "form" && (
          <>
            <header className={styles.intro}>
              <Emblem state={reset.isPending ? "working" : "idle"} />
              <h1 id={TITLE_ID} className={styles.title}>
                Elija una contraseña nueva
              </h1>
              <p className={styles.lead}>
                Al guardarla cerraremos la sesión en todos sus dispositivos, por
                si alguien más tenía la anterior.
              </p>
            </header>

            <form
              className={styles.form}
              noValidate
              onSubmit={handleSubmit}
              aria-labelledby={TITLE_ID}
            >
              {problem && (
                <div className={styles.alert} role="alert">
                  {problem === "tooManyAttempts" ? (
                    <p>
                      Hizo varios intentos seguidos. Espere 15 minutos e
                      inténtelo de nuevo.
                    </p>
                  ) : (
                    <p>
                      No pudimos guardar la contraseña. Inténtelo de nuevo; si
                      continúa, escríbanos a{" "}
                      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                    </p>
                  )}
                </div>
              )}

              <fieldset className={styles.fields}>
                <legend className="visually-hidden">Contraseña nueva</legend>
                <Field
                  ref={passwordRef}
                  label="Contraseña nueva"
                  name="contrasena"
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={password}
                  error={error}
                  describedBy={METER_ID}
                  onChange={(event) => setPassword(event.target.value)}
                >
                  <PasswordMeter id={METER_ID} password={password} />
                </Field>
              </fieldset>

              <div className={styles.submit}>
                <Button
                  type="submit"
                  variant="bright"
                  shape="pill"
                  block
                  busy={reset.isPending}
                >
                  {reset.isPending ? "Guardando…" : "Guardar la contraseña"}
                </Button>
              </div>
            </form>
          </>
        )}

        {stage === "done" && (
          <section className={styles.notice} aria-labelledby={TITLE_ID}>
            <CircleCheck size={28} aria-hidden="true" />
            <h1
              id={TITLE_ID}
              className={styles.noticeTitle}
              ref={headingRef}
              tabIndex={-1}
            >
              Su contraseña cambió
            </h1>
            <p>
              Cerramos la sesión en todos sus dispositivos y le enviamos un
              aviso por correo. Ingrese con su contraseña nueva.
            </p>
            <ButtonLink to={ROUTES.signIn} variant="bright" shape="pill">
              Ingresar
            </ButtonLink>
          </section>
        )}

        {stage === "invalid" && (
          <section className={styles.notice} aria-labelledby={TITLE_ID}>
            <LinkIcon size={28} aria-hidden="true" />
            <h1
              id={TITLE_ID}
              className={styles.noticeTitle}
              ref={headingRef}
              tabIndex={-1}
            >
              Este enlace ya no sirve
            </h1>
            <p>
              Los enlaces para restablecer la contraseña vencen en una hora y
              sirven una sola vez. Pida uno nuevo y ábralo desde el último
              correo que le enviemos.
            </p>
            <ButtonLink
              to={ROUTES.forgotPassword}
              variant="bright"
              shape="pill"
            >
              Pedir un enlace nuevo
            </ButtonLink>
          </section>
        )}
      </div>
    </>
  );
}
