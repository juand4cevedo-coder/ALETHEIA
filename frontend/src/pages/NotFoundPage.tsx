import { Link } from "react-router";

import { SITE_NAME } from "../config/site.ts";
import styles from "./NotFoundPage.module.css";

// Ruta inexistente o error al mostrar una página.
export function NotFoundPage() {
  return (
    <section className={styles.page}>
      <title>{`Página no encontrada · ${SITE_NAME}`}</title>
      <h1 className={styles.title}>No encontramos esta página</h1>
      <p className={styles.text}>
        Puede que la dirección haya cambiado o tenga un error.
      </p>
      <Link to="/">Volver al inicio</Link>
    </section>
  );
}
