import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { ExportListItemOut } from "../../api/generated";
import {
  createCaseExportMutation,
  listCaseExportsOptions,
  listCaseExportsQueryKey,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Hash } from "../../components/ui/Hash.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import { formatColombiaTime } from "./dates.ts";
import styles from "./ExportSection.module.css";

const STATUS = {
  queued: { tone: "pending", label: "En espera" },
  building: { tone: "pending", label: "Preparándose" },
  ready: { tone: "ok", label: "Listo" },
  expired: { tone: "muted", label: "Enlace vencido" },
  failed: { tone: "error", label: "Falló" },
} as const;

type Known = keyof typeof STATUS;

function statusOf(item: ExportListItemOut) {
  return STATUS[item.status as Known] ?? STATUS.failed;
}

const CONTENTS = [
  "Los archivos originales, tal como se conservaron.",
  "La huella SHA-256 de cada uno y un manifiesto con todas ellas.",
  "La cadena de custodia completa y su sello de tiempo externo.",
  "Un informe con el alcance del paquete, para quien lo reciba.",
];

export function ExportSection({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [shownLink, setShownLink] = useState("");
  const path = { case_id: caseId };
  const listing = useQuery({
    ...listCaseExportsOptions({ path }),
    // Mientras algún paquete se prepara, la lista se actualiza sola.
    refetchInterval: (query) =>
      query.state.data?.items.some(
        (item) => item.status === "queued" || item.status === "building",
      )
        ? 3000
        : false,
  });
  const items = listing.data?.items ?? [];
  const busy = items.some(
    (item) => item.status === "queued" || item.status === "building",
  );
  const create = useMutation({
    ...createCaseExportMutation(),
    onSuccess: async () => {
      setMessage("Solicitud recibida. Estamos preparando el paquete.");
      await queryClient.invalidateQueries({
        queryKey: listCaseExportsQueryKey({ path }),
      });
    },
  });

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(
        "Enlace copiado. Compártalo solo con la persona que recibirá el paquete.",
      );
      setShownLink("");
    } catch {
      setShownLink(url);
      setMessage("Seleccione y copie el enlace que aparece abajo.");
    }
  }

  return (
    <section aria-labelledby="export-title" className={styles.section}>
      <h2 id="export-title">Paquete de preservación</h2>
      <p>
        Reúne todo lo necesario para presentar el caso fuera de ALETHEIA. El
        enlace de cada paquete está disponible durante 24 horas desde que
        termina su preparación.
      </p>
      <ul className={styles.contents} aria-label="Qué incluye el paquete">
        {CONTENTS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Button
        busy={create.isPending}
        disabled={create.isPending || busy}
        onClick={() => {
          setMessage("");
          create.mutate({ path });
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

      <div className={styles.history}>
        <h3>Paquetes de este caso</h3>
        {listing.isPending && <p role="status">Cargando paquetes</p>}
        {listing.isError && (
          <Notice tone="error">
            No pudimos consultar los paquetes de este caso.
          </Notice>
        )}
        {listing.isSuccess && items.length === 0 && (
          <p className={styles.muted}>
            Todavía no se ha solicitado ningún paquete de este caso.
          </p>
        )}
        {items.length > 0 && (
          <ol className={styles.packages} aria-label="Paquetes del caso">
            {items.map((item) => {
              const state = statusOf(item);
              return (
                <li key={item.id} className={styles.package}>
                  <div className={styles.packageHead}>
                    <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                    <span>
                      Pedido por {item.requested_by_name} el{" "}
                      <time dateTime={item.created_at}>
                        {formatColombiaTime(item.created_at)}
                      </time>
                    </span>
                  </div>
                  {item.status === "queued" && (
                    <p role="status">En espera para prepararse.</p>
                  )}
                  {item.status === "building" && (
                    <p role="status">Preparando el paquete.</p>
                  )}
                  {item.status === "failed" && (
                    <p>
                      La preparación falló. Puede solicitar un paquete nuevo.
                    </p>
                  )}
                  {item.status === "expired" && (
                    <p>
                      El enlace venció
                      {item.expires_at
                        ? ` el ${formatColombiaTime(item.expires_at)}`
                        : ""}
                      . Puede solicitar un paquete nuevo.
                    </p>
                  )}
                  {item.status === "ready" && item.download_url && (
                    <>
                      <p>
                        Disponible hasta el{" "}
                        {item.expires_at
                          ? formatColombiaTime(item.expires_at)
                          : "su vencimiento"}
                        .
                      </p>
                      {item.manifest_sha256 && (
                        <div className={styles.manifest} translate="no">
                          <span>Huella del manifiesto</span>
                          <Hash value={item.manifest_sha256} variant="short" />
                        </div>
                      )}
                      <div className={styles.actions}>
                        <a href={item.download_url}>Abrir descarga</a>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void copyLink(item.download_url!)}
                        >
                          Copiar enlace
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {shownLink && (
          <label className={styles.copyField}>
            Enlace para compartir
            <input type="text" readOnly value={shownLink} />
          </label>
        )}
      </div>
    </section>
  );
}
