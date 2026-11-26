import { BrandMark } from "../components/ui/BrandMark.tsx";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  ScrollRestoration,
  useMatches,
  useLocation,
} from "react-router";

import { readMeOptions } from "../api/generated/@tanstack/react-query.gen.ts";

import { LEGAL_PAGES, legalRoute, ROUTES } from "../config/routes.ts";
import { SITE_NAME, TRIAL_DAYS, WORDMARK } from "../config/site.ts";
import { VistoIcon } from "../components/ui/icons.tsx";
import { useCookiePanel } from "../features/consent/useCookiePanel.tsx";
import { hasSessionHint } from "../features/session/sessionHint.ts";
import styles from "./AuthLayout.module.css";
import { Logotipo } from "../components/brand/Logotipo.tsx";
import { Emblema } from "../components/brand/Emblema.tsx";

/** Cambio a la otra pantalla de acceso, declarado en la ruta: va debajo del formulario. */
export type AuthSwitch = { question: string; label: string; to: string };

/** Datos que cada ruta de acceso declara en su `handle`. */
export type AuthHandle = {
  authSwitch?: AuthSwitch;
  /** Con una sesión abierta, la pantalla no tiene sentido y se va al espacio de trabajo. */
  redirectSignedIn?: boolean;
};

function isAuthSwitch(value: unknown): value is AuthSwitch {
  return (
    typeof value === "object" &&
    value !== null &&
    "to" in value &&
    "label" in value &&
    "question" in value
  );
}

const CURRENT_YEAR = new Date().getFullYear();

export function AuthLayout() {
  const { pathname } = useLocation();
  const signingUp =
    pathname === ROUTES.signUp || pathname === ROUTES.signUpEmail;
  const primaryAccess = pathname === ROUTES.signIn || signingUp;
  const {
    panel: cookiePanel,
    openPanel: openCookies,
    openerRef: cookiesButtonRef,
  } = useCookiePanel();
  const handles = useMatches().map(
    (match) => (match.handle ?? {}) as AuthHandle,
  );
  const authSwitch = handles
    .map((handle) => handle.authSwitch)
    .find(isAuthSwitch);

  // Ingresar, crear cuenta y recuperar la contraseña llevan al espacio de trabajo si ya hay
  // una sesión (Diseño UX/UI, 4.2). Solo se consulta la API cuando la pista de sesión existe:
  // una visita sin sesión no hace ninguna petición. Los enlaces de los correos (verificar,
  // restablecer, invitar) abren siempre su pantalla.
  const redirectSignedIn = handles.some((handle) => handle.redirectSignedIn);
  const [hinted] = useState(hasSessionHint);
  const me = useQuery({
    ...readMeOptions(),
    enabled: redirectSignedIn && hinted,
    retry: false,
    staleTime: 0,
  });
  if (redirectSignedIn && hinted && me.isFetchedAfterMount && me.isSuccess) {
    return (
      <Navigate
        to={me.data.platform_admin ? ROUTES.platform : ROUTES.app}
        replace
      />
    );
  }

  return (
    <div className={styles.shell} data-signup={signingUp || undefined}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>
      {cookiePanel}

      <header className={styles.header}>
        <Link to={ROUTES.home} className={styles.brand}>
          <BrandMark size={30} />
          <Logotipo />
          <span className="visually-hidden">{WORDMARK}</span>
        </Link>
        <Link to={ROUTES.home} className={styles.back}>
          Inicio
        </Link>
      </header>

      {!signingUp && (
        <section className={styles.visual} aria-label="ALETHEIA">
          <div className={styles.emblem}>
            <Emblema tamano={520} />
          </div>
          <div className={styles.visualCopy}>
            <p>Su evidencia, con huella, sello y custodia.</p>
            <span>Sus casos, su equipo y cada movimiento de cada archivo.</span>
          </div>
        </section>
      )}
      <main id="contenido" className={styles.main} tabIndex={-1}>
        <div className={styles.panel}>
          <Outlet />
        </div>
        {authSwitch && !primaryAccess && (
          <nav className={styles.switch} aria-label="Otra opción de acceso">
            <p>
              {authSwitch.question}{" "}
              <Link to={authSwitch.to}>{authSwitch.label}</Link>
            </p>
          </nav>
        )}
      </main>
      {/* Al crear la cuenta, el panel lateral recuerda lo que trae la prueba. En el teléfono
          va después del formulario, para no empujarlo hacia abajo. */}
      {signingUp && <TrialReminder />}

      <footer className={styles.footer}>
        <p>
          © {CURRENT_YEAR} {SITE_NAME}
        </p>
        <nav aria-label="Legal">
          <ul className={styles.footerList}>
            {LEGAL_PAGES.map((page) => (
              <li key={page.slug}>
                <Link to={legalRoute(page.slug)}>{page.label}</Link>
              </li>
            ))}
            <li>
              <button
                ref={cookiesButtonRef}
                type="button"
                className={styles.footerButton}
                onClick={openCookies}
              >
                Configurar cookies
              </button>
            </li>
          </ul>
        </nav>
      </footer>
      <ScrollRestoration />
    </div>
  );
}

const TRIAL_INCLUDES = [
  "Cada archivo que suba queda con su huella SHA-256 y su sello de tiempo.",
  "La cadena de custodia anota quién subió, descargó o exportó cada evidencia.",
  "El caso se exporta en un paquete que cualquier persona puede verificar.",
  "Usted invita a su equipo y decide quién entra a cada caso.",
] as const;

function TrialReminder() {
  return (
    <aside className={styles.trial} aria-labelledby="titulo-prueba">
      <div className={styles.trialInner}>
        <p className={styles.trialKicker}>
          {TRIAL_DAYS} días gratis, sin tarjeta de crédito
        </p>
        <h2 id="titulo-prueba" className={styles.trialTitle}>
          La prueba trae todas las funciones
        </h2>
        <ul className={styles.trialList}>
          {TRIAL_INCLUDES.map((item) => (
            <li key={item}>
              <VistoIcon size={18} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <p className={styles.trialNote}>
          Al terminar, usted elige el plan. Nada se cobra solo: si no elige
          ninguno, la cuenta queda 30 días en solo lectura para que exporte lo
          que guardó.
        </p>
      </div>
    </aside>
  );
}
