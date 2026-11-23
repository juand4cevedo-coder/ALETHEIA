import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { EvidenceSummaryOut } from "../../api/generated";
import { listEvidencesInfiniteOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Hash } from "../../components/ui/Hash.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { ROUTES } from "../../config/routes.ts";
import { Notice } from "../../components/ui/Notice.tsx";
import { EvidenceUploadForm } from "./EvidenceUploadForm.tsx";
import { formatColombiaTime } from "./dates.ts";
import styles from "./EvidenceSection.module.css";

const TYPE_LABELS: Record<EvidenceSummaryOut["declared_type"], string> = {
  chat: "Conversación",
  email: "Correo",
  audio: "Audio",
  image: "Imagen",
  document: "Documento",
  other: "Otro",
};

const DETECTED_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "Imagen PNG",
  "image/jpeg": "Imagen JPEG",
  "image/gif": "Imagen GIF",
  "application/zip": "Archivo ZIP",
  "audio/wav": "Audio WAV",
  "audio/mpeg": "Audio MP3",
  "text/plain": "Texto plano",
  "application/octet-stream": "Formato no identificado",
};

const SEAL = {
  pending: { tone: "pending", label: "Sello pendiente" },
  stamped: { tone: "ok", label: "Sello obtenido" },
  failed: { tone: "error", label: "Sello fallido" },
} as const;

type SealFilter = "all" | EvidenceSummaryOut["tsa_status"];
type TypeFilter = "all" | EvidenceSummaryOut["declared_type"];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} ${size === 1 ? "byte" : "bytes"}`;
  const unit = size < 1024 * 1024 ? "KB" : size < 1024 ** 3 ? "MB" : "GB";
  const divisor = unit === "KB" ? 1024 : unit === "MB" ? 1024 ** 2 : 1024 ** 3;
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(size / divisor)} ${unit}`;
}

export function EvidenceSection({
  caseId,
  canUpload,
}: {
  caseId: string;
  canUpload: boolean;
}) {
  const listing = useInfiniteQuery({
    ...listEvidencesInfiniteOptions({ path: { case_id: caseId } }),
    initialPageParam: { path: { case_id: caseId }, query: { limit: 20 } },
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
  const items = listing.data?.pages.flatMap((page) => page.items) ?? [];
  const [seal, setSeal] = useState<SealFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const sealCounts = { pending: 0, stamped: 0, failed: 0 };
  let totalBytes = 0;
  for (const item of items) {
    sealCounts[item.tsa_status] += 1;
    totalBytes += item.size_bytes;
  }
  const needle = normalize(search.trim());
  const shown = items.filter(
    (item) =>
      (seal === "all" || item.tsa_status === seal) &&
      (type === "all" || item.declared_type === type) &&
      (needle === "" || normalize(item.original_filename).includes(needle)),
  );
  const presentTypes = (
    Object.keys(TYPE_LABELS) as EvidenceSummaryOut["declared_type"][]
  ).filter((key) => items.some((item) => item.declared_type === key));

  return (
    <div className={styles.layout}>
      {canUpload && <EvidenceUploadForm caseId={caseId} />}
      <section
        aria-labelledby="case-evidence-title"
        className={styles.listSection}
      >
        <h2 id="case-evidence-title">Archivos conservados</h2>
        <p className={styles.intro}>
          El origen es una declaración de quien subió cada archivo. El tipo
          detectado se obtiene del contenido recibido.
        </p>
        {listing.isPending && <p role="status">Cargando evidencias</p>}
        {listing.isError && (
          <Notice tone="error">
            <p>No pudimos consultar las evidencias de este caso.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void listing.refetch()}
            >
              Intentar de nuevo
            </Button>
          </Notice>
        )}
        {listing.isSuccess && items.length === 0 && (
          <p className={styles.empty}>
            Este caso todavía no tiene archivos conservados.
          </p>
        )}
        {items.length > 0 && (
          <div className={styles.summary} role="status">
            <strong>
              {items.length} {items.length === 1 ? "archivo" : "archivos"}
            </strong>
            <span>{formatBytes(totalBytes)} en total</span>
            <span>{sealCounts.stamped} con sello obtenido</span>
            {sealCounts.pending > 0 && (
              <span>{sealCounts.pending} con sello pendiente</span>
            )}
            {sealCounts.failed > 0 && (
              <span className={styles.warn}>
                {sealCounts.failed} con sello fallido
              </span>
            )}
          </div>
        )}
        {items.length > 1 && (
          <div className={styles.toolbar}>
            <Field
              label="Buscar por nombre de archivo"
              type="text"
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div
              className={styles.filters}
              role="group"
              aria-label="Filtrar por sello de tiempo"
            >
              {(
                [
                  ["all", "Todas", items.length],
                  ["stamped", "Sello obtenido", sealCounts.stamped],
                  ["pending", "Sello pendiente", sealCounts.pending],
                  ["failed", "Sello fallido", sealCounts.failed],
                ] as const
              )
                .filter(([key, , count]) => key === "all" || count > 0)
                .map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    className={styles.chip}
                    aria-pressed={seal === key}
                    onClick={() => setSeal(key)}
                  >
                    {label}
                    <span className={styles.count}>{count}</span>
                  </button>
                ))}
            </div>
            {presentTypes.length > 1 && (
              <div
                className={styles.filters}
                role="group"
                aria-label="Filtrar por tipo"
              >
                {(["all", ...presentTypes] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={styles.chip}
                    aria-pressed={type === key}
                    onClick={() => setType(key)}
                  >
                    {key === "all" ? "Todos los tipos" : TYPE_LABELS[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {items.length > 0 && shown.length === 0 && (
          <p className={styles.empty}>
            Ninguna evidencia cargada coincide con el filtro. Si hay más,
            cárguelas para buscar ahí.
          </p>
        )}
        {shown.length > 0 && (
          <ol className={styles.list} aria-label="Evidencias del caso">
            {shown.map((item) => (
              <li key={item.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <h3>{item.original_filename}</h3>
                  <span className={styles.badges}>
                    <StatusBadge tone={SEAL[item.tsa_status].tone}>
                      {SEAL[item.tsa_status].label}
                    </StatusBadge>
                    <span>{TYPE_LABELS[item.declared_type]}</span>
                  </span>
                </div>
                <dl className={styles.details}>
                  <div>
                    <dt>Origen declarado</dt>
                    <dd>{item.declared_origin}</dd>
                  </div>
                  <div className={styles.hashRow}>
                    <dt>Huella SHA-256</dt>
                    <dd translate="no">
                      <Hash value={item.sha256} variant="short" />
                    </dd>
                  </div>
                  <div>
                    <dt>Tipo detectado por el sistema</dt>
                    <dd>
                      {DETECTED_LABELS[item.detected_type] ??
                        item.detected_type}
                    </dd>
                  </div>
                  <div>
                    <dt>Tamaño</dt>
                    <dd>{formatBytes(item.size_bytes)}</dd>
                  </div>
                  <div>
                    <dt>Conservado</dt>
                    <dd>
                      <time dateTime={item.uploaded_at}>
                        {formatColombiaTime(item.uploaded_at)}
                      </time>
                    </dd>
                  </div>
                </dl>
                <ButtonLink
                  to={ROUTES.evidenceDetail(caseId, item.id)}
                  variant="secondary"
                  size="sm"
                >
                  Ver detalle
                </ButtonLink>
              </li>
            ))}
          </ol>
        )}
        {listing.hasNextPage && (
          <Button
            variant="secondary"
            size="sm"
            disabled={listing.isFetchingNextPage}
            onClick={() => void listing.fetchNextPage()}
          >
            {listing.isFetchingNextPage ? "Cargando más" : "Ver más evidencias"}
          </Button>
        )}
      </section>
    </div>
  );
}
