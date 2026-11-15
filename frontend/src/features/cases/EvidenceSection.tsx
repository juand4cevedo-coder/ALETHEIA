import { useInfiniteQuery } from "@tanstack/react-query";

import type { EvidenceSummaryOut } from "../../api/generated";
import { listEvidencesInfiniteOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
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
          <ol className={styles.list} aria-label="Evidencias del caso">
            {items.map((item) => (
              <li key={item.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <h3>{item.original_filename}</h3>
                  <span>{TYPE_LABELS[item.declared_type]}</span>
                </div>
                <dl className={styles.details}>
                  <div>
                    <dt>Origen declarado</dt>
                    <dd>{item.declared_origin}</dd>
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
