import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { ROUTES } from "../config/routes.ts";
import { SITE_URL, pageTitle } from "../config/site.ts";
import {
  parseManifest,
  type PreservationManifest,
} from "../features/verifier/manifest.ts";
import styles from "./VerifierPage.module.css";

type Result = { expected: string; actual: string; matches: boolean };
type WorkerMessage =
  | { type: "progress"; bytes: number }
  | { type: "complete"; digest: string }
  | { type: "error" };

export function VerifierPage() {
  const [manifest, setManifest] = useState<PreservationManifest | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const selected = manifest?.evidences.find((item) => item.id === selectedId);

  useEffect(() => () => workerRef.current?.terminate(), []);

  function clearRun() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setProgress(null);
    setResult(null);
    setError("");
  }

  async function loadManifest(chosen: File | undefined) {
    clearRun();
    setManifest(null);
    setSelectedId("");
    if (!chosen) return;
    if (chosen.size > 10 * 1024 * 1024) {
      setError("El manifiesto supera el límite de lectura de 10 MB.");
      return;
    }
    try {
      const parsed = parseManifest(await chosen.text());
      setManifest(parsed);
      if (parsed.evidences.length === 1) setSelectedId(parsed.evidences[0].id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo leer el manifiesto.",
      );
    }
  }

  function verify() {
    clearRun();
    if (!file || !selected) return;
    if (file.size !== selected.size_bytes) {
      setError(
        `El tamaño difiere del manifiesto (${selected.size_bytes.toLocaleString("es-CO")} bytes esperados). Seleccione el archivo correspondiente.`,
      );
      return;
    }
    const worker = new Worker(
      new URL("../features/verifier/hash.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    setProgress(0);
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "progress") {
        setProgress(message.bytes);
      } else if (message.type === "complete") {
        setProgress(null);
        setResult({
          expected: selected.sha256,
          actual: message.digest,
          matches: message.digest === selected.sha256,
        });
        worker.terminate();
        workerRef.current = null;
      } else {
        setProgress(null);
        setError("No se pudo calcular la huella. Inténtelo de nuevo.");
        worker.terminate();
        workerRef.current = null;
      }
    };
    worker.onerror = () => {
      setProgress(null);
      setError("No se pudo calcular la huella. Inténtelo de nuevo.");
      worker.terminate();
      workerRef.current = null;
    };
    worker.postMessage({ file });
  }

  return (
    <>
      <title>{pageTitle("Verificador de archivos")}</title>
      <meta
        name="description"
        content="Compare en su navegador un archivo con el manifiesto de preservación de Aletheia. El archivo no se envía al servidor."
      />
      <link rel="canonical" href={`${SITE_URL}${ROUTES.verifier}`} />
      <section className={styles.page} aria-labelledby="verificador-titulo">
        <div className={styles.inner}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}>Verificación local con SHA-256</p>
            <h1 id="verificador-titulo">
              Compare un archivo con su manifiesto.
            </h1>
            <p>
              Seleccione el manifiesto del paquete de preservación y el archivo
              que desea comprobar. El cálculo ocurre en este navegador; ninguno
              de los dos archivos se envía a Aletheia.
            </p>
          </header>

          <div className={styles.form}>
            <label>
              <span>1. Manifiesto de preservación (manifest.json)</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(event) => void loadManifest(event.target.files?.[0])}
              />
            </label>
            {manifest && (
              <p className={styles.note} role="status">
                {manifest.evidences.length} archivo(s) registrados en el
                manifiesto.
              </p>
            )}
            {manifest && manifest.evidences.length > 1 && (
              <label>
                <span>2. Registro que desea comprobar</span>
                <select
                  value={selectedId}
                  onChange={(event) => {
                    clearRun();
                    setSelectedId(event.target.value);
                  }}
                >
                  <option value="">Seleccione un registro</option>
                  {manifest.evidences.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.original_filename} ({item.id})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>
                {manifest && manifest.evidences.length > 1 ? "3" : "2"}. Archivo
                a comprobar
              </span>
              <input
                type="file"
                onChange={(event) => {
                  clearRun();
                  setFile(event.target.files?.[0] ?? null);
                }}
              />
            </label>
            <button
              type="button"
              onClick={verify}
              disabled={!selected || !file || progress !== null}
            >
              Comparar huellas
            </button>
            {progress !== null && file && (
              <p role="status">
                Calculando: {Math.round((progress / file.size) * 100)} %
              </p>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </div>

          {result && (
            <section className={styles.result} aria-live="polite">
              <h2>
                {result.matches
                  ? "Las huellas coinciden"
                  : "Las huellas no coinciden"}
              </h2>
              <dl>
                <dt>Huella del manifiesto</dt>
                <dd>{result.expected}</dd>
                <dt>Huella calculada</dt>
                <dd>{result.actual}</dd>
              </dl>
            </section>
          )}
          <p className={styles.scope}>
            Una coincidencia indica que este archivo tiene la misma huella que
            el registro seleccionado. No autentica el manifiesto ni determina la
            procedencia o validez jurídica del archivo.{" "}
            <Link to="/docs/verificar-un-archivo">
              Conozca el alcance de esta comprobación
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
