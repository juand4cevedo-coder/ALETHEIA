import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";

import {
  listCasesQueryKey,
  listEvidencesInfiniteQueryKey,
  readCaseQueryKey,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { sessionFetch } from "../../api/sessionFetch.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import styles from "./EvidenceUploadForm.module.css";

type Result = {
  id: string;
  sha256: string;
  size_bytes: number;
  tsa_status: string;
};

const TYPES = [
  ["document", "Documento"],
  ["chat", "Conversación"],
  ["email", "Correo"],
  ["audio", "Audio"],
  ["image", "Imagen"],
  ["other", "Otro"],
] as const;

export function EvidenceUploadForm({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const fields = event.currentTarget.elements;
      const type = fields.namedItem("tipo") as HTMLSelectElement | null;
      const origin = fields.namedItem("origen") as HTMLInputElement | null;
      const fileInput = fields.namedItem("archivo") as HTMLInputElement | null;
      const file = fileInput?.files?.[0];
      if (!type || !origin || !file || file.size === 0) {
        setError("Seleccione un archivo con contenido.");
        return;
      }
      const body = new FormData();
      body.append("tipo", type.value);
      body.append("origen", origin.value);
      body.append("archivo", file, file.name);
      const response = await sessionFetch(
        new URL(`/api/v1/cases/${caseId}/evidences`, window.location.origin),
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-Aletheia-Request": "1" },
          body,
        },
      );
      if (!response.ok) {
        if (response.status === 413) {
          setError(
            "El archivo supera el límite de tamaño o el espacio disponible del plan.",
          );
        } else if (response.status === 403) {
          setError("Ya no tiene permiso para subir evidencia a este caso.");
        } else if (response.status === 409) {
          setError("Este caso o despacho no admite nuevas evidencias.");
        } else if (response.status === 422) {
          setError("Revise el tipo, el origen y el archivo seleccionado.");
        } else {
          setError("No pudimos conservar el archivo. Inténtelo de nuevo.");
        }
        return;
      }
      const saved = (await response.json()) as Result;
      setResult(saved);
      form.current?.reset();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: readCaseQueryKey({ path: { case_id: caseId } }),
        }),
        queryClient.invalidateQueries({ queryKey: listCasesQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: listEvidencesInfiniteQueryKey({
            path: { case_id: caseId },
          }),
        }),
      ]);
    } catch {
      setError(
        "Se interrumpió la carga. Compruebe su conexión e inténtelo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.box} aria-labelledby="evidence-upload-title">
      <h2 id="evidence-upload-title">Agregar evidencia</h2>
      <p>
        Indique qué recibe y de dónde proviene. El origen queda registrado como
        su declaración.
      </p>
      <form
        ref={form}
        onSubmit={(event) => void submit(event)}
        className={styles.form}
      >
        <label>
          Tipo de archivo
          <select name="tipo" required disabled={busy} defaultValue="document">
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Origen declarado
          <input
            name="origen"
            type="text"
            required
            maxLength={500}
            disabled={busy}
            placeholder="Ej.: entregado por el cliente"
          />
        </label>
        <label>
          Archivo
          <input name="archivo" type="file" required disabled={busy} />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Conservando archivo" : "Conservar evidencia"}
        </Button>
      </form>
      {error && (
        <Notice tone="error">
          <p role="alert">{error}</p>
        </Notice>
      )}
      {result && (
        <Notice tone="success">
          <p role="status">Archivo conservado. La huella SHA-256 es:</p>
          <code className={styles.hash} translate="no">
            {result.sha256}
          </code>
          <p>El sello de tiempo está pendiente.</p>
        </Notice>
      )}
    </section>
  );
}
