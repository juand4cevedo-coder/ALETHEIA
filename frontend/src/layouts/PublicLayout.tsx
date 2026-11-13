import { useEffect, useRef, useState } from "react";
import { Link, Outlet, ScrollRestoration, useLocation } from "react-router";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { CONSUMER_AUTHORITY } from "../config/legal.ts";
import { ROUTES } from "../config/routes.ts";
import {
  NAVIGATION as GROUPS,
  FOOTER_NAVIGATION as FOOTER_GROUPS,
} from "../config/navigation.ts";
import { PublicNavigation } from "./PublicNavigation.tsx";
import {
  CONTACT_EMAIL,
  SIGN_UP_LABEL,
  SITE_NAME,
  WORDMARK,
} from "../config/site.ts";
import { useCookiePanel } from "../features/consent/useCookiePanel.tsx";
import { hasSessionHint } from "../features/session/sessionHint.ts";
import { prefetchLikelyNext } from "../routes/lazyRoutes.ts";
import {
  CerrarIcon,
  ChevronAbajoIcon,
  FlechaDerechaIcon,
  MenuIcon,
} from "../components/ui/icons.tsx";
import styles from "./PublicLayout.module.css";

const CURRENT_YEAR = new Date().getFullYear();
function Brand() {
  return (
    <Link to={ROUTES.home} className={styles.brand} aria-label={WORDMARK}>
      <span aria-hidden="true">{WORDMARK}</span>
    </Link>
  );
}

export function PublicLayout() {
  const location = useLocation();
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
  useEffect(() => prefetchLikelyNext(), []);
  useEffect(() => {
    menuRef.current?.close();
  }, [location]);
  const closeMenu = () => menuRef.current?.close();
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>
      {cookiePanel}
      <header className={styles.header}>
        <div className={styles.bar}>
          <Brand />
          <PublicNavigation key={location.pathname + location.hash} />
          <div className={styles.actions}>
            <Link to={access.to} className={styles.signIn}>
              {access.label}
            </Link>
            <span className={styles.headerCta}>
              <ButtonLink to={ROUTES.signUp} size="sm">
                {SIGN_UP_LABEL}
              </ButtonLink>
            </span>
            <button
              className={styles.menuButton}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls="menu-movil"
              onClick={() => {
                menuRef.current?.showModal();
                setMenuOpen(true);
              }}
            >
              <MenuIcon size={20} />
              <span className="visually-hidden">Menú</span>
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
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <div className={styles.sheetHead}>
          <p id="menu-movil-titulo">Menú</p>
          <button type="button" onClick={closeMenu}>
            <CerrarIcon size={18} />
            Cerrar
          </button>
        </div>
        <nav aria-label="Navegación móvil">
          {GROUPS.map((group) => (
            <details
              key={group.title}
              className={styles.mobileGroup}
              name="mobile-navigation"
            >
              <summary>
                {group.title}
                <ChevronAbajoIcon size={16} aria-hidden="true" />
              </summary>
              <div className={styles.mobileLinks}>
                {group.links.map((link) => (
                  <Link key={link.to} to={link.to} onClick={closeMenu}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          ))}
          <Link to={ROUTES.pricing} onClick={closeMenu}>
            Precios
          </Link>
          <Link to={access.to} onClick={closeMenu}>
            {access.label}
          </Link>
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
            <p>Su trabajo. Con claridad.</p>
            <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>
            <Link className={styles.statusLink} to="/estado">
              Consultar estado <FlechaDerechaIcon size={14} />
            </Link>
          </div>
          <div className={styles.footerNav}>
            {FOOTER_GROUPS.map((group) => (
              <nav aria-label={group.title} key={group.title}>
                <p className={styles.footerTitle}>{group.title}</p>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to}>{link.label}</Link>
                    </li>
                  ))}
                  {group.title === "Legal" && (
                    <li>
                      <button
                        ref={cookiesButtonRef}
                        type="button"
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
        <div className={styles.footerBottom}>
          <p>
            © {CURRENT_YEAR} {SITE_NAME}
          </p>
          <Link to="/legal/terminos">
            Identificación y contacto del proveedor
          </Link>
          <a href={CONSUMER_AUTHORITY.url} rel="noopener noreferrer">
            {CONSUMER_AUTHORITY.name}
          </a>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
