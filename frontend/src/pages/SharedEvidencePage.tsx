import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import {
  inspectSharedEvidence,
  type SharedEvidenceInfo,
} from "../api/generated";
import { Button } from "../components/ui/Button.tsx";
import { Hash } from "../components/ui/Hash.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { tokenFromHash } from "../features/auth/linkToken.ts";
import { formatBytes } from "../features/billing/format.ts";
import styles from "./ExportDownloadPage.module.css";

type State =
  | { kind: "checking" }
  | { kind: "ready"; info: SharedEvidenceInfo }
  | { kind: "expired" }
  | { kind: "error" };

// Página pública de un enlace para compartir una evidencia. El fragmento nunca viaja al
// servidor ni queda en la barra de direcciones: la página lo lee, lo borra de la dirección y lo
// manda solo en el cuerpo de la petición.
export function SharedEvidencePage() {
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
    void inspectSharedEvidence({
      body: { token },
      signal: controller.signal,
      throwOnError: true,
    })
      .then(({ data }) => setState({ kind: "ready", info: data }))
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
      <title>{pageTitle("Descargar evidencia")}</title>
      <meta name="robots" content="noindex" />
      <div className={styles.card}>
        <h1>Descargar evidencia</h1>
        {state.kind === "checking" && (
          <p role="status">Comprobando el enlace.</p>
        )}
        {state.kind === "expired" && (
          <Notice tone="info">
            <p>
              Este enlace no existe, ya venció o fue revocado. Pídale a quien se
              lo envió que genere uno nuevo.
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
              <strong>{state.info.filename}</strong>,{" "}
              {formatBytes(state.info.size_bytes)}. El enlace está vigente hasta
              el{" "}
              <time dateTime={state.info.expires_at}>
                {new Intl.DateTimeFormat("es-CO", {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: "America/Bogota",
                }).format(new Date(state.info.expires_at))}
              </time>
              .
            </p>
            <form
              action="/api/v1/shared-evidence/download"
              method="post"
              className={styles.form}
            >
              <input type="hidden" name="token" value={token} />
              <Button type="submit">Descargar el archivo</Button>
            </form>
            <p className={styles.scope}>
              Antes de entregarlo, ALETHEIA comprueba el archivo contra su
              huella SHA-256. Puede verificarlo usted también con esta huella:
            </p>
            <Hash value={state.info.sha256} variant="full" />
            <p className={styles.scope}>
              Esta descarga queda registrada en la cadena de custodia del caso.
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
