import { useMutation } from "@tanstack/react-query";
import { CircleCheck, LinkIcon, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import type { VerifyEmailError } from "../api/generated";
import { verifyEmailMutation } from "../api/generated/@tanstack/react-query.gen.ts";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_NAME } from "../config/site.ts";
import { tokenFromHash } from "../features/auth/linkToken.ts";
import { ResendVerification } from "../features/auth/ResendVerification.tsx";
import styles from "./VerifyEmailPage.module.css";

const DATE = new Intl.DateTimeFormat("es-CO", { dateStyle: "long" });
const TIME = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type Outcome =
  | { kind: "verifying" }
  | { kind: "verified"; at: Date }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "tooManyAttempts" }
  | { kind: "unexpected" };

function outcomeFrom(error: unknown): Outcome {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as VerifyEmailError).status
      : undefined;
  if (status === 400) return { kind: "invalid" };
  if (status === 429) return { kind: "tooManyAttempts" };
  return { kind: "unexpected" };
}

// Verificar el correo (UI-007, HU-006). La página toma el token del fragmento, lo borra de la
// dirección para que no quede en el historial y lo envía una sola vez. Cada estado dice solo lo
// que pasó: verificado, enlace que ya no sirve o falla.
export function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => tokenFromHash(location.hash));
  const [outcome, setOutcome] = useState<Outcome>(() =>
    token ? { kind: "verifying" } : { kind: "missing" },
  );
  const sent = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const verify = useMutation({
    ...verifyEmailMutation(),
    onSuccess: () => setOutcome({ kind: "verified", at: new Date() }),
    onError: (error) => setOutcome(outcomeFrom(error)),
  });
  const { mutate } = verify;

  useEffect(() => {
    // El token sale de la dirección apenas se lee, y se envía una sola vez aunque React monte
    // el efecto dos veces en desarrollo: un segundo envío lo daría por usado.
    if (location.hash) {
      void navigate(location.pathname, { replace: true });
    }
    if (token && !sent.current) {
      sent.current = true;
      mutate({ body: { token } });
    }
  }, [location.hash, location.pathname, navigate, mutate, token]);

  useEffect(() => {
    // Quien usa lector de pantalla escucha el resultado apenas cambia.
    if (outcome.kind !== "verifying") headingRef.current?.focus();
  }, [outcome.kind]);

  return (
    <section className={styles.screen} aria-labelledby="titulo-verificacion">
      <title>{`Verificar el correo · ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex" />
      {outcome.kind === "verifying" && (
        <div className={styles.status} role="status">
          <LoaderCircle
            className={styles.spinner}
            size={28}
            aria-hidden="true"
          />
          <h1 id="titulo-verificacion" className={styles.title}>
            Verificando su correo…
          </h1>
        </div>
      )}

      {outcome.kind === "verified" && (
        <>
          <h1
            id="titulo-verificacion"
            className={styles.title}
            ref={headingRef}
            tabIndex={-1}
          >
            Correo verificado
          </h1>
          <figure className={styles.record}>
            <figcaption className={styles.recordTitle}>
              Constancia de verificación
            </figcaption>
            <dl className={styles.rows}>
              <div className={styles.row}>
                <dt>
                  <CircleCheck size={16} aria-hidden="true" />
                  Estado
                </dt>
                <dd>Verificado</dd>
              </div>
              <div className={styles.row}>
                <dt>
                  <ShieldCheck size={16} aria-hidden="true" />
                  Fecha y hora
                </dt>
                <dd>
                  {DATE.format(outcome.at)}, {TIME.format(outcome.at)}
                </dd>
              </div>
              <div className={styles.row}>
                <dt>
                  <LinkIcon size={16} aria-hidden="true" />
                  Enlace
                </dt>
                <dd>Usado. No vuelve a servir.</dd>
              </div>
            </dl>
          </figure>
          <p className={styles.lead}>
            Ya puede ingresar con su correo y su contraseña.
          </p>
          <ButtonLink to={ROUTES.signIn} surface="dark">
            Ingresar
          </ButtonLink>
        </>
      )}

      {(outcome.kind === "invalid" || outcome.kind === "missing") && (
        <>
          <h1
            id="titulo-verificacion"
            className={styles.title}
            ref={headingRef}
            tabIndex={-1}
          >
            Este enlace ya no sirve
          </h1>
          <p className={styles.lead}>
            {outcome.kind === "missing"
              ? "El enlace llegó incompleto. Ábralo desde el botón del correo o pida uno nuevo."
              : "Puede que haya vencido, que ya se haya usado o que el correo de la cuenta haya cambiado. Pida uno nuevo con su correo."}
          </p>
          <ResendVerification />
        </>
      )}

      {(outcome.kind === "tooManyAttempts" ||
        outcome.kind === "unexpected") && (
        <>
          <h1
            id="titulo-verificacion"
            className={styles.title}
            ref={headingRef}
            tabIndex={-1}
          >
            No pudimos verificar el correo
          </h1>
          <p className={styles.lead} role="alert">
            {outcome.kind === "tooManyAttempts" ? (
              "Hizo varios intentos seguidos. Espere 15 minutos y abra de nuevo el enlace del correo."
            ) : (
              <>
                Inténtelo de nuevo abriendo el enlace del correo; si continúa,
                escríbanos a{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}
