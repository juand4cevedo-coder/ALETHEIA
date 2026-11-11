import { Link } from "react-router";

import { pageTitle } from "../config/site.ts";
import styles from "./NotFoundPage.module.css";

// Ruta inexistente o error al mostrar una página.
export function NotFoundPage() {
  return (
    <section className={styles.page}>
      <title>{pageTitle("Página no encontrada")}</title>
      <h1 className={styles.title}>No encontramos esta página</h1>
      <p className={styles.text}>
        Es posible que la dirección haya cambiado o tenga un error. Revísela o
        vuelva al inicio.
      </p>
      <Link to="/">Volver al inicio</Link>
    </section>
  );
}
