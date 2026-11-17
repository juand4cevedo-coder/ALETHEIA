import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { inspectExport } from "../api/generated";
import { Button } from "../components/ui/Button.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { tokenFromHash } from "../features/auth/linkToken.ts";
import styles from "./ExportDownloadPage.module.css";

type State =
  | { kind: "checking" }
  | { kind: "ready"; expiresAt: string }
  | { kind: "expired" }
  | { kind: "error" };

/** El fragmento nunca viaja al servidor ni queda en la barra de direcciones. */
export function ExportDownloadPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => tokenFromHash(location.hash));
  const [state, setState] = useState<State>(
    token ? { kind: "checking" } : { kind: "expired" },
  );

  useEffect(() => {
    if (location.hash) void navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void inspectExport({
      body: { token },
      signal: controller.signal,
      throwOnError: true,
    })
      .then(({ data }) =>
        setState({ kind: "ready", expiresAt: data.expires_at }),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: apiProblem(error).status === 404 ? "expired" : "error",
        });
      });
    return () => controller.abort();
  }, [token]);

  return (
    <main className={styles.page}>
      <title>{pageTitle("Descargar paquete")}</title>
      <meta name="robots" content="noindex" />
      <div className={styles.card}>
        <p className={styles.eyebrow}>Paquete de preservación</p>
        <h1>Descargar paquete</h1>
        {state.kind === "checking" && (
          <p role="status">Comprobando el enlace.</p>
        )}
        {state.kind === "expired" && (
          <Notice tone="info">
            <p>
              Este enlace no existe o ya venció. Solicite un nuevo paquete desde
              el caso.
            </p>
          </Notice>
        )}
        {state.kind === "error" && (
          <Notice tone="error">
            <p>
              No pudimos comprobar el enlace. Recargue la página para intentarlo
              de nuevo.
            </p>
          </Notice>
        )}
        {state.kind === "ready" && token && (
          <>
            <p>
              El enlace está vigente hasta el{" "}
              <time dateTime={state.expiresAt}>
                {new Intl.DateTimeFormat("es-CO", {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: "America/Bogota",
                }).format(new Date(state.expiresAt))}
              </time>
              .
            </p>
            <form
              action="/api/v1/exports/download"
              method="post"
              className={styles.form}
            >
              <input type="hidden" name="token" value={token} />
              <Button type="submit">Descargar ZIP</Button>
            </form>
            <p className={styles.scope}>
              El paquete permite comprobar huellas y cadena de custodia. Un
              sello de tiempo externo solo aparece cuando una autoridad lo haya
              emitido.
            </p>
          </>
        )}
        <Link className={styles.back} to={ROUTES.home}>
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
