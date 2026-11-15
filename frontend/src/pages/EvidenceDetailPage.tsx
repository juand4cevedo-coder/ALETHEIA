import { useInfiniteQuery } from "@tanstack/react-query";
import { useParams } from "react-router";

import { readEvidence } from "../api/generated";
import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { Hash } from "../components/ui/Hash.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { StatusBadge } from "../components/ui/StatusBadge.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { custodyActionLabel } from "../features/cases/custodyActions.ts";
import { formatColombiaTime } from "../features/cases/dates.ts";
import styles from "./EvidenceDetailPage.module.css";

const SEAL = {
  pending: { tone: "pending", label: "Sello pendiente" },
  stamped: { tone: "ok", label: "Sello obtenido" },
  failed: { tone: "error", label: "Sello fallido" },
} as const;

export function EvidenceDetailPage() {
  const { caseId = "", evidenceId = "" } = useParams();
  const back = `${ROUTES.caseDetail(caseId)}#evidencias`;
  const detail = useInfiniteQuery({
    queryKey: ["evidenceDetail", caseId, evidenceId],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await readEvidence({
        path: { case_id: caseId, evidence_id: evidenceId },
        query: pageParam === null ? undefined : { event_cursor: pageParam },
        signal,
        throwOnError: true,
      });
      return data;
    },
    getNextPageParam: (page) => page.next_event_seq ?? undefined,
    retry: (count, error) => {
      const status = apiProblem(error).status;
      return status !== 404 && status !== 422 && count < 2;
    },
  });

  if (detail.isPending) {
    return (
      <div className={styles.screen}>
        <title>{pageTitle("Evidencia")}</title>
        <meta name="robots" content="noindex" />
        <p role="status">Cargando evidencia</p>
      </div>
    );
  }

  if (detail.isError && !detail.data) {
    const problem = apiProblem(detail.error);
    const missing = problem.status === 404 || problem.status === 422;
    return (
      <div className={styles.screen}>
        <title>{pageTitle("Evidencia no disponible")}</title>
        <meta name="robots" content="noindex" />
        <PageHeader title="Evidencia no disponible" />
        <Notice tone={missing ? "info" : "error"}>
          {missing ? (
            MESSAGES.notFound
          ) : (
            <SystemError requestId={problem.requestId} />
          )}
        </Notice>
        <div className={styles.actions}>
          {!missing && (
            <Button variant="secondary" onClick={() => void detail.refetch()}>
              Intentar de nuevo
            </Button>
          )}
          <ButtonLink to={back} variant="secondary">
            Volver al caso
          </ButtonLink>
        </div>
      </div>
    );
  }

  const evidence = detail.data.pages[0];
  const events = detail.data.pages.flatMap((page) => page.events);
  const seal = SEAL[evidence.tsa_status];
  return (
    <div className={styles.screen}>
      <title>{pageTitle(evidence.original_filename)}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title={evidence.original_filename}
        description="Metadatos de la evidencia conservada"
        actions={
          <ButtonLink to={back} variant="secondary">
            Volver al caso
          </ButtonLink>
        }
      />
      <section className={styles.panel} aria-labelledby="evidence-metadata">
        <h2 id="evidence-metadata">Archivo y procedencia</h2>
        <dl className={styles.facts}>
          <div>
            <dt>Origen declarado por quien subió el archivo</dt>
            <dd>{evidence.declared_origin}</dd>
          </div>
          <div>
            <dt>Tipo declarado</dt>
            <dd>{evidence.declared_type}</dd>
          </div>
          <div>
            <dt>Tipo detectado por el sistema</dt>
            <dd>{evidence.detected_type}</dd>
          </div>
          <div>
            <dt>Tamaño exacto</dt>
            <dd>
              {new Intl.NumberFormat("es-CO").format(evidence.size_bytes)} bytes
            </dd>
          </div>
          <div>
            <dt>Conservado</dt>
            <dd>
              <time dateTime={evidence.uploaded_at}>
                {formatColombiaTime(evidence.uploaded_at)}
              </time>
            </dd>
          </div>
          <div>
            <dt>Huella SHA-256</dt>
            <dd>
              <Hash value={evidence.sha256} variant="full" />
            </dd>
          </div>
          <div>
            <dt>Sello de tiempo</dt>
            <dd>
              <StatusBadge tone={seal.tone}>{seal.label}</StatusBadge>
              {evidence.tsa_time && (
                <time dateTime={evidence.tsa_time}>
                  {formatColombiaTime(evidence.tsa_time, { seconds: true })}
                </time>
              )}
            </dd>
          </div>
        </dl>
      </section>
      <section className={styles.panel} aria-labelledby="evidence-events">
        <h2 id="evidence-events">Eventos de esta evidencia</h2>
        <p>
          Los números indican su posición en la cadena de custodia del caso.
        </p>
        <ol className={styles.events}>
          {events.map((event) => (
            <li key={event.seq}>
              <div>
                <strong>
                  #{event.seq}: {custodyActionLabel(event.action)}
                </strong>
                <span>{event.actor_name ?? "Sistema"}</span>
              </div>
              <time dateTime={event.occurred_at}>
                {formatColombiaTime(event.occurred_at, { seconds: true })}
              </time>
              <div className={styles.eventHash}>
                <span>Huella del evento</span>
                <Hash value={event.event_hash} variant="full" />
              </div>
            </li>
          ))}
        </ol>
        {detail.isFetchNextPageError && (
          <Notice tone="error">
            No pudimos cargar más eventos. Inténtelo de nuevo.
          </Notice>
        )}
        {detail.hasNextPage && (
          <Button
            variant="secondary"
            disabled={detail.isFetchingNextPage}
            onClick={() => void detail.fetchNextPage()}
          >
            {detail.isFetchingNextPage ? "Cargando más" : "Ver más eventos"}
          </Button>
        )}
      </section>
    </div>
  );
}
