import { Link, NavLink, Outlet, ScrollRestoration } from "react-router";

import { SITE_NAME } from "../config/site.ts";
import styles from "./PublicLayout.module.css";

// Año del aviso de derechos, calculado una vez al cargar el sitio.
const CURRENT_YEAR = new Date().getFullYear();

// Marco del sitio público: encabezado, contenido de cada página y pie.
export function PublicLayout() {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link to="/" className={styles.wordmark}>
            {SITE_NAME}
          </Link>
          <nav aria-label="Principal">
            <NavLink
              to="/precios"
              className={({ isActive }) =>
                isActive
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
            >
              Precios
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="contenido" className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>
          © {CURRENT_YEAR} {SITE_NAME}. Preservación de evidencia digital.
        </p>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
