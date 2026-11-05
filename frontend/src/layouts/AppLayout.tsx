import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import {
  Link,
  Navigate,
  Outlet,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Me, ReadMeError } from "../api/generated";
import { readMeOptions } from "../api/generated/@tanstack/react-query.gen.ts";
import markUrl from "../assets/aletheia-mark.png";
import { Button } from "../components/ui/Button.tsx";
import { ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_NAME } from "../config/site.ts";
import { ROLE_LABELS } from "../features/workspace/roles.ts";
import styles from "./AppLayout.module.css";

function isUnauthorized(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as ReadMeError).status === 401
  );
}

// Marco del espacio de trabajo: todo lo que vive bajo /app exige sesión. Pregunta a la API
// quién la tiene (API-014); la API comprueba la sesión en cada petición, así que una sesión
// cerrada o vencida responde 401 y lleva a ingresar, recordando la pantalla pedida (NAV-003).
export function AppLayout() {
  const location = useLocation();
  // Sin reintentos ni copia vieja: la respuesta dice si la sesión sigue viva ahora.
  const me = useQuery({ ...readMeOptions(), retry: false, staleTime: 0 });

  if (me.isError && isUnauthorized(me.error)) {
    return (
      <Navigate
        to={ROUTES.signIn}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>
      <header className={styles.header}>
        <Link to={ROUTES.app} className={styles.brand}>
          <img src={markUrl} alt="" width={25} height={24} />
          <span>{SITE_NAME}</span>
        </Link>
        {me.data && <Identity me={me.data} />}
      </header>

      <main
        id="contenido"
        className={styles.main}
        tabIndex={-1}
        aria-busy={me.isPending}
      >
        {me.isPending && (
          <p className={styles.status} role="status">
            <LoaderCircle
              className={styles.spinner}
              size={20}
              aria-hidden="true"
            />
            Abriendo su espacio de trabajo…
          </p>
        )}
        {me.isError && (
          <div className={styles.failure} role="alert">
            {/* MSG-019. */}
            <p>
              No pudimos abrir su espacio de trabajo. Inténtelo de nuevo; si
              continúa, escríbanos a{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
            <Button
              surface="dark"
              variant="secondary"
              size="sm"
              onClick={() => void me.refetch()}
            >
              Intentar de nuevo
            </Button>
          </div>
        )}
        {me.data && <Outlet context={me.data} />}
      </main>
      <ScrollRestoration />
    </div>
  );
}

function Identity({ me }: { me: Me }) {
  return (
    <p className={styles.identity}>
      <span className={styles.person}>{me.full_name}</span>
      {me.organization && (
        <span className={styles.organization}>
          {me.organization.name} · {ROLE_LABELS[me.organization.role]}
        </span>
      )}
    </p>
  );
}
