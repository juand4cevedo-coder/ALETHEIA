import "@fontsource-variable/source-serif-4/opsz.css";

import { Link, Outlet, ScrollRestoration, useMatches } from "react-router";

import markUrl from "../assets/aletheia-mark.png";
import { LEGAL_PAGES, legalRoute, ROUTES } from "../config/routes.ts";
import { SITE_NAME } from "../config/site.ts";
import { useCookiePanel } from "../features/consent/useCookiePanel.tsx";
import styles from "./AuthLayout.module.css";

/** Enlace del encabezado hacia la otra pantalla de acceso, declarado en la ruta. */
export type AuthSwitch = { question: string; label: string; to: string };

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

// Marco de las pantallas de acceso: crear cuenta, ingresar, recuperar la contraseña, verificar
// el correo y aceptar una invitación. Sin la navegación del sitio, para que la atención quede
// en el formulario; solo el logotipo, el cambio a la otra pantalla y los enlaces legales.
export function AuthLayout() {
  const {
    panel: cookiePanel,
    openPanel: openCookies,
    openerRef: cookiesButtonRef,
  } = useCookiePanel();
  const authSwitch = useMatches()
    .map((match) => (match.handle as { authSwitch?: unknown })?.authSwitch)
    .find(isAuthSwitch);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>
      {cookiePanel}

      <header className={styles.header}>
        <Link to={ROUTES.home} className={styles.brand}>
          <img src={markUrl} alt="" width={25} height={24} />
          <span>{SITE_NAME}</span>
        </Link>
        {authSwitch && (
          <p className={styles.switch}>
            <span className={styles.switchQuestion}>{authSwitch.question}</span>{" "}
            <Link to={authSwitch.to}>{authSwitch.label}</Link>
          </p>
        )}
      </header>

      <main id="contenido" className={styles.main} tabIndex={-1}>
        <Outlet />
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
