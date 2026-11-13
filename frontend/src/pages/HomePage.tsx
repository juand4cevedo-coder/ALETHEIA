import { lazy, Suspense } from "react";

import { pageTitle, SITE_URL } from "../config/site.ts";
import { PlanCatalogProvider } from "../features/billing/catalog.tsx";
import { Hero } from "../features/landing/Hero.tsx";
import styles from "./HomePage.module.css";

// Lo que queda debajo del primer pantallazo llega aparte (BelowFold.tsx).
const BelowFold = lazy(() =>
  import("../features/landing/BelowFold.tsx").then((module) => ({
    default: module.BelowFold,
  })),
);

// Página de inicio (UI-001, HU-001). Cada sección responde una pregunta del abogado, en el
// orden en que se la hace (especificación de identidad, sección 11). El titular, los planes y
// el cierre leen el mismo catálogo, pedido una sola vez.
export function HomePage() {
  return (
    <PlanCatalogProvider>
      <title>{pageTitle("Un espacio para sus casos y su equipo")}</title>
      <meta
        name="description"
        content="Organice sus casos y su equipo jurídico. Compruebe huellas SHA-256 en su navegador y explore los fundamentos de la evidencia digital."
      />
      <link rel="canonical" href={`${SITE_URL}/`} />

      <Hero />
      {/* Mientras llega, el espacio reservado mantiene el pie fuera de la vista. */}
      <Suspense
        fallback={
          <div
            className={styles.pending}
            aria-busy="true"
            data-route-loading=""
          />
        }
      >
        <BelowFold />
      </Suspense>
    </PlanCatalogProvider>
  );
}
