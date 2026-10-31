import { Link } from "react-router";

import { SITE_NAME } from "../config/site.ts";
import styles from "./HomePage.module.css";

// Inicio provisional: HU-001 lo reemplaza por la landing completa.
export function HomePage() {
  return (
    <section className={styles.hero}>
      <title>{`${SITE_NAME} · Preservación de evidencia digital`}</title>
      <h1 className={styles.title}>{SITE_NAME}</h1>
      <p className={styles.lead}>
        Preservación de evidencia digital para abogados en Colombia.
      </p>
      <Link to="/precios" className={styles.link}>
        Ver planes y precios
      </Link>
    </section>
  );
}
