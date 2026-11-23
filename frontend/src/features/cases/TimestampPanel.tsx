import { useMutation, useQueryClient } from "@tanstack/react-query";

import { retryEvidenceTimestampMutation } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { buttonClassName } from "../../components/ui/buttonStyles.ts";
import { Notice } from "../../components/ui/Notice.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import { formatColombiaTime } from "./dates.ts";
import styles from "./TimestampPanel.module.css";

type Props = {
  caseId: string;
  evidenceId: string;
  filename: string;
  sha256: string;
  status: "pending" | "stamped" | "failed";
  time: string | null;
  authority: string | null | undefined;
  /** Quién puede pedir otra vez un sello fallido: quien sube evidencia. */
  canRetry: boolean;
  onChanged: () => void;
};

// Sello de tiempo RFC 3161 de una evidencia (HU-020): cuándo se obtuvo y quién lo firmó, cómo
// comprobarlo sin ALETHEIA, y pedirlo otra vez si falló.
export function TimestampPanel({
  caseId,
  evidenceId,
  filename,
  sha256,
  status,
  time,
  authority,
  canRetry,
  onChanged,
}: Props) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    ...retryEvidenceTimestampMutation(),
    onSuccess: async () => {
      onChanged();
      await queryClient.invalidateQueries();
    },
  });
  const tsr = `/api/v1/cases/${caseId}/evidences/${evidenceId}/timestamp`;

  return (
    <Panel
      title="Sello de tiempo"
      description="Prueba, firmada por una autoridad externa, de que esta huella existía en esa fecha."
    >
      <div className={styles.stack}>
        {status === "pending" && (
          <>
            <StatusBadge tone="pending">Sello pendiente</StatusBadge>
            <p>
              Estamos pidiendo el sello a la autoridad. Suele llegar en unos
              minutos; esta pantalla se actualiza al volver a abrirla.
            </p>
          </>
        )}
        {status === "stamped" && (
          <>
            <StatusBadge tone="ok">Sello obtenido</StatusBadge>
            <p>
              {time ? (
                <>
                  Sellado el{" "}
                  <time dateTime={time}>
                    {formatColombiaTime(time, { seconds: true })}
                  </time>
                </>
              ) : (
                "Sellado"
              )}
              {authority ? ` por ${authority}.` : "."}
            </p>
            <div>
              <a
                href={tsr}
                download
                className={buttonClassName({
                  variant: "secondary",
                  size: "sm",
                })}
              >
                Descargar el sello (.tsr)
              </a>
            </div>
            <details>
              <summary>Cómo verificarlo sin ALETHEIA</summary>
              <p>
                Descargue el original y el sello, y compruebe con OpenSSL que el
                sello corresponde a ese archivo. Necesita el certificado de la
                autoridad, que ella publica.
              </p>
              <pre translate="no">
                {`openssl ts -verify -data "${filename}" -in "${filename}.tsr" -CAfile autoridad.pem`}
              </pre>
              <p>
                La huella SHA-256 del archivo, para cotejar el sello, es{" "}
                <code translate="no">{sha256}</code>.
              </p>
            </details>
          </>
        )}
        {status === "failed" && (
          <>
            <StatusBadge tone="error">Sello fallido</StatusBadge>
            <p>
              La autoridad no concedió un sello válido para esta huella. La
              evidencia y su cadena de custodia siguen intactas; solo falta este
              sello.
            </p>
            {canRetry && (
              <div>
                <Button
                  size="sm"
                  busy={retry.isPending}
                  onClick={() =>
                    retry.mutate({
                      path: { case_id: caseId, evidence_id: evidenceId },
                    })
                  }
                >
                  Pedir el sello otra vez
                </Button>
              </div>
            )}
            {retry.isError && (
              <Notice tone="error">
                <p role="alert">
                  {apiProblem(retry.error).detail ??
                    "No pudimos pedir el sello. Inténtelo de nuevo."}
                </p>
              </Notice>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
