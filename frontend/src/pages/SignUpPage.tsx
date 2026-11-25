import { type FormEvent, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { Field } from "../components/ui/Field.tsx";
import { LEGAL_VERSION } from "../config/legal.ts";
import { ROUTES } from "../config/routes.ts";
import { TRIAL_DAYS } from "../config/site.ts";
import { AccountTypeChoice } from "../features/auth/AccountTypeChoice.tsx";
import { LegalConsent } from "../features/auth/LegalConsent.tsx";
import { SocialAccess } from "../features/auth/SocialAccess.tsx";
import type { AccountType } from "../features/auth/signUp.ts";
import styles from "../features/auth/AccessScreen.module.css";
import { CabeceraSeo } from "../seo/CabeceraSeo.tsx";
import { PAGINAS } from "../seo/fichas.ts";

const TITLE_ID = "titulo-registro";

const GOOGLE_NOTICES: Record<string, string> = {
  "sin-cuenta":
    "Ese correo de Google todavía no tiene cuenta en ALETHEIA. Elija el tipo de cuenta, acepte los términos y créela aquí con Google.",
  "correo-en-uso":
    "Ya existe una cuenta con ese correo. Ingrese y vincule Google desde Mi cuenta.",
  "legal-cambio":
    "Los términos o la política de privacidad cambiaron. Recargue la página y revíselos antes de continuar.",
  limite:
    "Se hicieron varios intentos seguidos. Espere 15 minutos antes de volver a intentarlo.",
  error:
    "No pudimos comprobar la identidad con Google. Inténtelo de nuevo; no se creó ninguna cuenta.",
};

export function SignUpPage() {
  const location = useLocation();
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [organizationName, setOrganizationName] = useState("");
  const [acceptsLegalTerms, setAcceptsLegalTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const organizationRef = useRef<HTMLInputElement>(null);
  const legalRef = useRef<HTMLInputElement>(null);
  const firm = accountType === "firm";
  const googleNotice =
    GOOGLE_NOTICES[new URLSearchParams(location.search).get("google") ?? ""];
  const organizationError =
    submitted && firm && !organizationName.trim()
      ? "Escriba el nombre de su oficina o firma."
      : undefined;
  const legalError =
    submitted && !acceptsLegalTerms
      ? "Para abrir la cuenta debe aceptar los términos y autorizar el tratamiento de sus datos."
      : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitted(true);
    if (firm && !organizationName.trim()) {
      event.preventDefault();
      organizationRef.current?.focus();
      return;
    }
    if (!acceptsLegalTerms) {
      event.preventDefault();
      legalRef.current?.focus();
    }
  }

  return (
    <>
      <CabeceraSeo meta={PAGINAS.registro} />

      <div className={styles.screen}>
        <header className={styles.intro}>
          <h1 id={TITLE_ID} className={styles.title}>
            Cree su cuenta
          </h1>
          <p className={styles.lead}>
            ¿Ya tiene cuenta? <Link to={ROUTES.signIn}>Ingresar</Link>
          </p>
        </header>

        {googleNotice && (
          <div className={styles.alert} role="alert">
            <p>{googleNotice}</p>
          </div>
        )}

        <form
          className={styles.form}
          method="post"
          action="/api/v1/auth/google/register"
          noValidate
          onSubmit={handleSubmit}
          aria-labelledby={TITLE_ID}
        >
          <AccountTypeChoice
            name="account_type"
            value={accountType}
            onChange={(value) => {
              setAccountType(value);
              setSubmitted(false);
              if (value === "individual") setOrganizationName("");
            }}
          />

          {firm && (
            <div className={styles.appear}>
              <Field
                ref={organizationRef}
                label="Nombre de la oficina o firma"
                name="organization_name"
                autoComplete="organization"
                required
                maxLength={120}
                value={organizationName}
                error={organizationError}
                onChange={(event) => setOrganizationName(event.target.value)}
              />
            </div>
          )}

          <input type="hidden" name="legal_version" value={LEGAL_VERSION} />
          <div className={styles.terms}>
            <LegalConsent
              ref={legalRef}
              checked={acceptsLegalTerms}
              error={legalError}
              onChange={(event) => setAcceptsLegalTerms(event.target.checked)}
            />
          </div>

          <div className={styles.submit}>
            <SocialAccess mode="register" />
            <p className={styles.trialHint}>
              Empieza con {TRIAL_DAYS} días de prueba, sin tarjeta de crédito.
            </p>
          </div>
          <p className={styles.help}>
            Aletheia recibirá de Google su nombre, correo verificado e
            identificador estable. No recibirá su contraseña de Google.
          </p>
        </form>
        <p className={styles.lead}>
          ¿Prefiere no usar Google?{" "}
          <Link to={ROUTES.signUpEmail}>
            Crear la cuenta con correo y contraseña
          </Link>
        </p>
      </div>
    </>
  );
}
