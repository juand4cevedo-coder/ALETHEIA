import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration } from "react-router";

import logoUrl from "../assets/logo.svg";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { CONSUMER_AUTHORITY, DATA_CONTROLLER } from "../config/legal.ts";
import { LEGAL_PAGES, legalRoute, ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_NAME, WORDMARK } from "../config/site.ts";
import { useCookiePanel } from "../features/consent/useCookiePanel.tsx";
import { hasSessionHint } from "../features/session/sessionHint.ts";
import { prefetchLikelyNext } from "../routes/lazyRoutes.ts";
import styles from "./PublicLayout.module.css";
import {
  CerrarIcon,
  CorreoIcon,
  FlechaDiagonalIcon,
  InstitucionIcon,
  MenuIcon,
} from "../components/ui/icons.tsx";

// Año del aviso de derechos, calculado una vez al cargar el sitio.
const CURRENT_YEAR = new Date().getFullYear();

// La acción principal del sitio público. Dice lo mismo que el enlace de la pantalla de ingreso.
const SIGN_UP_LABEL = "Crear una cuenta";

// Cada enlace lleva a una sección que existe en el inicio o a una página propia.
const PRIMARY_LINKS = [
  { to: ROUTES.howItWorks, label: "Producto" },
  { to: ROUTES.security, label: "Seguridad" },
  { to: ROUTES.pricing, label: "Precios" },
  { to: ROUTES.verifierSection, label: "Verificar" },
] as const;

const FOOTER_GROUPS = [
  {
    title: "Producto",
    links: [
      { to: ROUTES.howItWorks, label: "Cómo funciona" },
      { to: ROUTES.security, label: "Seguridad" },
      { to: ROUTES.pricing, label: "Precios" },
      { to: ROUTES.verifierSection, label: "Verificar un paquete" },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { to: ROUTES.signIn, label: "Ingresar" },
      { to: ROUTES.signUp, label: SIGN_UP_LABEL },
    ],
  },
  {
    title: "Legal",
    links: LEGAL_PAGES.map((page) => ({
      to: legalRoute(page.slug),
      label: page.label,
    })),
  },
] as const;

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? `${styles.navLink} ${styles.navLinkActive}`
    : styles.navLink;
}

function Brand() {
  return (
    <Link to={ROUTES.home} className={styles.brand}>
      <img src={logoUrl} alt="" width={24} height={24} />
      <span>{WORDMARK}</span>
    </Link>
  );
}

// Marco del sitio público (CMP-UI-011, barra pública). El encabezado es una franja fija sobre el
// fondo de la página, separada por la línea. En pantallas angostas la navegación se abre en una
// hoja inferior: un <dialog> nativo que atrapa el foco y se cierra con Escape.
export function PublicLayout() {
  // Con una sesión abierta, «Ingresar» lleva directo al espacio de trabajo (Diseño UX/UI, 4.2).
  const [access] = useState(() =>
    hasSessionHint()
      ? { to: ROUTES.app, label: "Ir a mis casos" }
      : { to: ROUTES.signIn, label: "Ingresar" },
  );
  const menuRef = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    panel: cookiePanel,
    openPanel: openCookies,
    openerRef: cookiesButtonRef,
  } = useCookiePanel();

  // Con el sitio público ya en pantalla, las siguientes pantallas probables se descargan en
  // segundo plano.
  useEffect(() => prefetchLikelyNext(), []);

  function openMenu() {
    menuRef.current?.showModal();
    setMenuOpen(true);
  }

  function closeMenu() {
    menuRef.current?.close();
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>

      {cookiePanel}

      <header className={styles.header}>
        <div className={styles.bar}>
          <Brand />

          <nav aria-label="Principal" className={styles.desktopNav}>
            <ul className={styles.navList}>
              {PRIMARY_LINKS.map((link) => (
                <li key={link.to}>
                  {link.to.includes("#") ? (
                    // Un enlace a una sección del inicio no marca la página como activa.
                    <Link to={link.to} className={styles.navLink}>
                      {link.label}
                    </Link>
                  ) : (
                    <NavLink to={link.to} className={navLinkClass}>
                      {link.label}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.actions}>
            <NavLink
              to={access.to}
              className={`${styles.navLink} ${styles.signIn}`}
            >
              {access.label}
            </NavLink>
            <span className={styles.headerCta}>
              <ButtonLink to={ROUTES.signUp} size="sm">
                {SIGN_UP_LABEL}
              </ButtonLink>
            </span>
            <button
              type="button"
              className={styles.menuButton}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls="menu-movil"
              onClick={openMenu}
            >
              <MenuIcon size={16} />
              Menú
            </button>
          </div>
        </div>
      </header>

      <dialog
        id="menu-movil"
        ref={menuRef}
        className={styles.sheet}
        aria-labelledby="menu-movil-titulo"
        onClose={() => setMenuOpen(false)}
        onClick={(event) => {
          // Un clic en el fondo oscuro, fuera de la hoja, la cierra.
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <div className={styles.sheetHead}>
          <p id="menu-movil-titulo" className={styles.sheetTitle}>
            Menú
          </p>
          <button
            type="button"
            className={styles.sheetClose}
            onClick={closeMenu}
          >
            <CerrarIcon size={16} />
            Cerrar
          </button>
        </div>
        <nav aria-label="Menú">
          <ul className={styles.sheetList}>
            {[...PRIMARY_LINKS, access].map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={styles.sheetLink}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sheetCta}>
          <ButtonLink to={ROUTES.signUp} onClick={closeMenu}>
            {SIGN_UP_LABEL}
          </ButtonLink>
        </div>
      </dialog>

      <main id="contenido" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Brand />
            <p className={styles.footerText}>
              Conserva el archivo original de su evidencia digital y deja
              constancia de cada paso que da su equipo con él.
            </p>
            <a className={styles.footerMail} href={`mailto:${CONTACT_EMAIL}`}>
              <CorreoIcon size={16} aria-hidden="true" />
              <span translate="no">{CONTACT_EMAIL}</span>
            </a>
          </div>
          <div className={styles.footerNav}>
            {FOOTER_GROUPS.map((group) => (
              <nav
                key={group.title}
                aria-label={group.title}
                className={styles.footerGroup}
                data-group={group.title === "Legal" ? "legal" : undefined}
              >
                <p className={styles.footerTitle}>{group.title}</p>
                <ul className={styles.footerList}>
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className={styles.footerLink}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  {group.title === "Legal" && (
                    <li>
                      <button
                        ref={cookiesButtonRef}
                        type="button"
                        className={`${styles.footerLink} ${styles.footerButton}`}
                        onClick={openCookies}
                      >
                        Configurar cookies
                      </button>
                    </li>
                  )}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Identidad de quien vende y enlace visible a la autoridad de protección al
            consumidor (Ley 1480 de 2011, art. 50, literal a y parágrafo). */}
        <div className={styles.footerLegal}>
          <ul className={styles.operator} aria-label="Quién opera el servicio">
            <li>Operado por {DATA_CONTROLLER.name}</li>
            <li>NIT {DATA_CONTROLLER.nit}</li>
            <li>{DATA_CONTROLLER.taxStatus}</li>
            <li>{DATA_CONTROLLER.address}</li>
          </ul>
          <a
            className={styles.footerAuthority}
            href={CONSUMER_AUTHORITY.url}
            rel="noopener noreferrer"
          >
            <InstitucionIcon size={16} aria-hidden="true" />
            {CONSUMER_AUTHORITY.name}
            <FlechaDiagonalIcon size={16} aria-hidden="true" />
          </a>
        </div>

        <div className={styles.footerBottom}>
          <p>
            © {CURRENT_YEAR} {SITE_NAME}. Todos los derechos reservados.
          </p>
          <p>
            Preservamos y documentamos evidencia digital. No certificamos
            pruebas ni decidimos sobre su validez.
          </p>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
