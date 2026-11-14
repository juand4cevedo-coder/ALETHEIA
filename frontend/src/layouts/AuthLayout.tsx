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
import { SITE_NAME } from "../config/site.ts";
import { useCookiePanel } from "../features/consent/useCookiePanel.tsx";
import { hasSessionHint } from "../features/session/sessionHint.ts";
import styles from "./AuthLayout.module.css";

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

const logoUrl = "/brand/symbol-white.svg";
const CURRENT_YEAR = new Date().getFullYear();

// Un formulario centrado para todos los recorridos de acceso. El fondo es decorativo.
export function AuthLayout() {
  const { pathname } = useLocation();
  const primaryAccess =
    pathname === ROUTES.signIn || pathname === ROUTES.signUp;
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
  });
  if (redirectSignedIn && me.isSuccess) {
    return (
      <Navigate
        to={me.data.platform_admin ? ROUTES.platform : ROUTES.app}
        replace
      />
    );
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>
      {cookiePanel}

      <header className={styles.header}>
        <Link to={ROUTES.home} className={styles.brand}>
          <span aria-hidden="true">‹</span> Inicio
          <span className="visually-hidden">, ir al inicio</span>
        </Link>
      </header>

      <main id="contenido" className={styles.main} tabIndex={-1}>
        <img
          className={styles.symbol}
          src={logoUrl}
          alt=""
          width={48}
          height={48}
        />
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
