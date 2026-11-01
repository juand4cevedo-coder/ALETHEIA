import { useRef, useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration } from "react-router";

import markUrl from "../assets/aletheia-mark.png";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { LEGAL_PAGES, legalRoute, ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_NAME } from "../config/site.ts";
import styles from "./PublicLayout.module.css";

// Año del aviso de derechos, calculado una vez al cargar el sitio.
const CURRENT_YEAR = new Date().getFullYear();

const PRIMARY_LINKS = [
  { to: ROUTES.howItWorks, label: "Cómo funciona" },
  { to: ROUTES.pricing, label: "Precios" },
  { to: ROUTES.verifier, label: "Verificador" },
] as const;

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? `${styles.navLink} ${styles.navLinkActive}`
    : styles.navLink;
}

// Marco del sitio público (CMP-UI-011, barra pública): encabezado fijo, contenido de cada
// página y pie con las páginas legales. En pantallas angostas la navegación se abre en una
// hoja inferior, que es un <dialog> nativo: atrapa el foco y se cierra con Escape.
export function PublicLayout() {
  const menuRef = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

      <header className={styles.header}>
        <div className={styles.bar}>
          <Link to={ROUTES.home} className={styles.brand}>
            <img src={markUrl} alt="" width={29} height={28} />
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
            <ButtonLink to={ROUTES.signUp} surface="dark" size="sm">
              Probar gratis
            </ButtonLink>
            <button
              type="button"
              className={styles.menuButton}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls="menu-movil"
              onClick={openMenu}
            >
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
            Cerrar
          </button>
        </div>
        <nav aria-label="Menú">
          <ul className={styles.sheetList}>
            {PRIMARY_LINKS.map((link) => (
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
            <li>
              <Link
                to={ROUTES.signIn}
                className={styles.sheetLink}
                onClick={closeMenu}
              >
                Ingresar
              </Link>
            </li>
          </ul>
        </nav>
      </dialog>

      <main id="contenido" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <p className={styles.footerName}>{SITE_NAME}</p>
            <p>Preservación de evidencia digital para abogados en Colombia.</p>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </div>
          <nav aria-label="Legal">
            <ul className={styles.legalList}>
              {LEGAL_PAGES.map((page) => (
                <li key={page.slug}>
                  <Link to={legalRoute(page.slug)}>{page.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className={styles.footerNote}>
          © {CURRENT_YEAR} {SITE_NAME}. ALETHEIA preserva y documenta evidencia
          digital; no certifica pruebas ni determina su validez.
        </p>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
