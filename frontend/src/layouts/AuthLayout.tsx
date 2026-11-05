import { Link, Outlet, ScrollRestoration, useMatches } from "react-router";

import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { LEGAL_PAGES, legalRoute, ROUTES } from "../config/routes.ts";
import { SITE_NAME } from "../config/site.ts";
import { AuthScene } from "../features/auth/AuthScene.tsx";
import { useCookiePanel } from "../features/consent/useCookiePanel.tsx";
import styles from "./AuthLayout.module.css";

/** Cambio a la otra pantalla de acceso, declarado en la ruta: va debajo del formulario. */
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
// el correo y aceptar una invitación (ADR-029). Una columna centrada sobre la escena del alba,
// sin la navegación del sitio, para que la atención quede en el formulario. Debajo van el
// cambio a la otra pantalla, los enlaces legales y las cookies.
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
      <AuthScene />

      <header className={styles.header}>
        <Link to={ROUTES.home} className={styles.brand}>
          {SITE_NAME}
          <span className="visually-hidden">, ir al inicio</span>
        </Link>
      </header>

      <main id="contenido" className={styles.main} tabIndex={-1}>
        <Outlet />
        {authSwitch && (
          <nav className={styles.switch} aria-label="Otra opción de acceso">
            <p>{authSwitch.question}</p>
            <ButtonLink
              to={authSwitch.to}
              variant="secondary"
              surface="dark"
              shape="pill"
            >
              {authSwitch.label}
            </ButtonLink>
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
