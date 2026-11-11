import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, pageTitle } from "../config/site.ts";
import styles from "./NotFoundPage.module.css";

// Ruta inexistente o error al mostrar una página. Son dos cosas distintas y cada una dice cómo
// seguir: una dirección que no existe se corrige o se vuelve al inicio; una página que falló al
// cargar (por ejemplo, porque se publicó una versión nueva mientras estaba abierta) se recarga.
export function NotFoundPage() {
  // Como página de una ruta (la de «*» o una política que no existe) no hay error y React Router
  // devuelve null; como errorElement trae lo que falló.
  const error = useRouteError();
  const notFound =
    error == null || (isRouteErrorResponse(error) && error.status === 404);

  if (notFound) {
    return (
      <section className={styles.page} aria-labelledby="titulo-error">
        <title>{pageTitle("Página no encontrada")}</title>
        <h1 id="titulo-error" className={styles.title}>
          No encontramos esta página
        </h1>
        <p className={styles.text}>
          Es posible que la dirección haya cambiado o tenga un error. Revísela o
          vuelva al inicio.
        </p>
        <ButtonLink to={ROUTES.home}>Volver al inicio</ButtonLink>
      </section>
    );
  }

  return (
    <section className={styles.page} aria-labelledby="titulo-error">
      <title>{pageTitle("No pudimos mostrar la página")}</title>
      <h1 id="titulo-error" className={styles.title}>
        No pudimos mostrar esta página
      </h1>
      <p className={styles.text}>
        Recárguela para intentarlo de nuevo. Si vuelve a pasar, escríbanos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <div className={styles.actions}>
        <Button onClick={() => window.location.reload()}>
          Recargar la página
        </Button>
        <Link to={ROUTES.home} className={styles.link}>
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
