import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration } from "react-router";

import markUrl from "../assets/aletheia-mark.png";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { LEGAL_PAGES, legalRoute, ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_NAME } from "../config/site.ts";
import { CookiePanel } from "../features/consent/CookiePanel.tsx";
import { useCookieChoice } from "../features/consent/useCookieChoice.ts";
import styles from "./PublicLayout.module.css";

// Año del aviso de derechos, calculado una vez al cargar el sitio.
const CURRENT_YEAR = new Date().getFullYear();

// Desde cuántos píxeles de desplazamiento el encabezado toma fondo.
const SCROLLED_AT = 8;

const PRIMARY_LINKS = [
  { to: ROUTES.howItWorks, label: "Cómo funciona" },
  { to: ROUTES.pricing, label: "Precios" },
  { to: ROUTES.verifier, label: "Verificador" },
] as const;

const FOOTER_GROUPS = [
  { title: "Producto", links: PRIMARY_LINKS },
  {
    title: "Cuenta",
    links: [
      { to: ROUTES.signIn, label: "Ingresar" },
      { to: ROUTES.signUp, label: "Crear cuenta" },
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

// Marco del sitio público (CMP-UI-011, barra pública). El encabezado es transparente sobre la
// portada y toma un fondo translúcido al desplazarse. En pantallas angostas la navegación se
// abre en una hoja inferior: un <dialog> nativo que atrapa el foco y se cierra con Escape.
export function PublicLayout() {
  const menuRef = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // El panel de cookies aparece solo mientras no haya una elección guardada (primera visita o
  // versión nueva del consentimiento) y cuando el visitante lo abre desde el pie.
  const cookieChoice = useCookieChoice();
  const [cookiesOpen, setCookiesOpen] = useState(false);
  const [cookieNotice, setCookieNotice] = useState("");
  const cookiesButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // React descarta el cambio de estado si el valor no cambió, así que el listener solo
    // provoca un render al cruzar el umbral.
    const update = () => setScrolled(window.scrollY > SCROLLED_AT);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  function openMenu() {
    menuRef.current?.showModal();
    setMenuOpen(true);
  }

  function closeMenu() {
    menuRef.current?.close();
  }

  function openCookies() {
    setCookieNotice("");
    setCookiesOpen(true);
  }

  function closeCookies(saved: boolean) {
    if (saved) setCookieNotice("Guardamos su elección sobre las cookies.");
    if (cookiesOpen) {
      setCookiesOpen(false);
      // El foco vuelve al botón del pie desde el que se abrió el panel.
      cookiesButtonRef.current?.focus();
    }
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>

      {(cookiesOpen || cookieChoice === null) && (
        <CookiePanel
          // Abrirlo desde el pie reinicia el panel en la vista de configuración.
          key={cookiesOpen ? "pie" : "aviso"}
          choice={cookieChoice}
          openedByVisitor={cookiesOpen}
          onClose={closeCookies}
        />
      )}
      <p role="status" className="visually-hidden">
        {cookieNotice}
      </p>

      <header
        className={styles.header}
        data-scrolled={scrolled ? "true" : "false"}
      >
        <div className={styles.bar}>
          <Link to={ROUTES.home} className={styles.brand}>
            <img src={markUrl} alt="" width={25} height={24} />
            <span>{SITE_NAME}</span>
          </Link>

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
              to={ROUTES.signIn}
              className={`${styles.navLink} ${styles.signIn}`}
            >
              Ingresar
            </NavLink>
            <span className={styles.headerCta}>
              <ButtonLink to={ROUTES.signUp} surface="dark" size="sm">
                Probar gratis
                <ArrowRight size={16} />
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
              <Menu size={18} />
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
            <X size={18} />
            Cerrar
          </button>
        </div>
        <nav aria-label="Menú">
          <ul className={styles.sheetList}>
            {[...PRIMARY_LINKS, { to: ROUTES.signIn, label: "Ingresar" }].map(
              (link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className={styles.sheetLink}
                    onClick={closeMenu}
                  >
                    {link.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
        <div className={styles.sheetCta}>
          <ButtonLink to={ROUTES.signUp} surface="dark" onClick={closeMenu}>
            Crear cuenta gratis
            <ArrowRight size={18} />
          </ButtonLink>
        </div>
      </dialog>

      <main id="contenido" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Link to={ROUTES.home} className={styles.brand}>
              <img src={markUrl} alt="" width={25} height={24} />
              <span>{SITE_NAME}</span>
            </Link>
            <p className={styles.footerText}>
              Preservación de evidencia digital para abogados y firmas en
              Colombia.
            </p>
            <a className={styles.footerMail} href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <nav
              key={group.title}
              aria-label={group.title}
              className={styles.footerGroup}
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
        <div className={styles.footerBottom}>
          <p>
            © {CURRENT_YEAR} {SITE_NAME}. Todos los derechos reservados.
          </p>
          <p>
            ALETHEIA preserva y documenta evidencia digital; no certifica
            pruebas ni determina su validez.
          </p>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
