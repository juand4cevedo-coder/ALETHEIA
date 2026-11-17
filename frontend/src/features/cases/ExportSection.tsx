import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  createCaseExportMutation,
  readCaseExportOptions,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import styles from "./ExportSection.module.css";

function storageKey(caseId: string) {
  return `aletheia-export:${caseId}`;
}

export function ExportSection({ caseId }: { caseId: string }) {
  const [exportId, setExportId] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey(caseId)) ?? "";
    } catch {
      return "";
    }
  });
  const [message, setMessage] = useState("");
  const [showLink, setShowLink] = useState(false);
  const create = useMutation({
    ...createCaseExportMutation(),
    onSuccess: (result) => {
      setExportId(result.id);
      setMessage("Solicitud recibida. Estamos preparando el paquete.");
      try {
        sessionStorage.setItem(storageKey(caseId), result.id);
      } catch {
        // La consulta sigue disponible mientras esta página permanezca abierta.
      }
    },
  });
  const exportQuery = useQuery({
    ...readCaseExportOptions({
      path: { case_id: caseId, export_id: exportId },
    }),
    enabled: exportId !== "",
    refetchInterval: (query) =>
      query.state.data?.status === "queued" ||
      query.state.data?.status === "building"
        ? 3000
        : false,
    retry: false,
  });
  const current = exportQuery.data;

  async function copyLink() {
    if (!current?.download_url) return;
    try {
      await navigator.clipboard.writeText(current.download_url);
      setMessage(
        "Enlace copiado. Compártalo solo con la persona que recibirá el paquete.",
      );
    } catch {
      setShowLink(true);
      setMessage("Seleccione y copie el enlace que aparece abajo.");
    }
  }

  return (
    <section aria-labelledby="export-title" className={styles.section}>
      <h2 id="export-title">Paquete de preservación</h2>
      <p>
        Reúne los originales, sus huellas, la cadena de custodia y un informe de
        alcance. El enlace estará disponible durante 24 horas desde que termine
        la preparación.
      </p>
      <Button
        busy={create.isPending}
        disabled={
          create.isPending ||
          current?.status === "queued" ||
          current?.status === "building"
        }
        onClick={() => {
          setMessage("");
          create.mutate({ path: { case_id: caseId } });
        }}
      >
        Solicitar paquete
      </Button>
      {message && <Notice tone="info">{message}</Notice>}
      {create.isError && (
        <Notice tone="error">
          {apiProblem(create.error).detail ??
            "No pudimos solicitar el paquete."}
        </Notice>
      )}
      {exportQuery.isError && (
        <Notice tone="error">
          No pudimos consultar el estado del paquete.
        </Notice>
      )}
      {current?.status === "queued" && (
        <p role="status">En espera para prepararse.</p>
      )}
      {current?.status === "building" && (
        <p role="status">Preparando el paquete.</p>
      )}
      {current?.status === "failed" && (
        <Notice tone="error">
          La preparación falló. Puede solicitar un paquete nuevo.
        </Notice>
      )}
      {current?.status === "expired" && (
        <Notice tone="info">
          El enlace venció. Puede solicitar un paquete nuevo.
        </Notice>
      )}
      {current?.status === "ready" && current.download_url && (
        <div className={styles.ready}>
          <p role="status">El paquete está listo.</p>
          <div className={styles.actions}>
            <a href={current.download_url}>Abrir descarga</a>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void copyLink()}
            >
              Copiar enlace
            </Button>
          </div>
          {showLink && (
            <label className={styles.copyField}>
              Enlace para compartir
              <input type="text" readOnly value={current.download_url} />
            </label>
          )}
        </div>
      )}
    </section>
  );
}
