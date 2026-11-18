import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { Field } from "../../components/ui/Field.tsx";
import {
  ArchivoBusquedaIcon,
  EscudoVistoIcon,
} from "../../components/ui/icons.tsx";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import styles from "./VerifierSection.module.css";

type WorkerMessage =
  | { type: "progress"; bytes: number }
  | { type: "complete"; digest: string }
  | { type: "error" };

export function VerifierSection() {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [expected, setExpected] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const supported = typeof Worker !== "undefined";
  const workerRef = useRef<Worker | null>(null);
  const busy = progress !== null;
  const normalized = expected.trim().toLowerCase();
  const validExpected = /^[a-f0-9]{64}$/.test(normalized);
  const matches = hash && validExpected ? hash === normalized : null;

  useEffect(() => () => workerRef.current?.terminate(), []);

  function verify() {
    if (!file || busy || !supported) return;
    setHash(null);
    setError("");
    const worker = new Worker(
      new URL("../verifier/hash.worker.ts", import.meta.url),
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
        setHash(message.digest);
        worker.terminate();
        workerRef.current = null;
      } else {
        setProgress(null);
        setError(
          "No pudimos leer el archivo. Vuelva a seleccionarlo e intente de nuevo.",
        );
        worker.terminate();
        workerRef.current = null;
      }
    };
    worker.onerror = () => {
      setProgress(null);
      setError(
        "No pudimos leer el archivo. Vuelva a seleccionarlo e intente de nuevo.",
      );
      worker.terminate();
      workerRef.current = null;
    };
    worker.postMessage({ file });
  }

  return (
    <section
      data-reveal
      id="verificador"
      className={styles.section}
      aria-labelledby="titulo-verificador"
    >
      <div className={section.inner}>
        <div className={styles.layout}>
          <div className={styles.copy}>
            <SectionHeading
              id="titulo-verificador"
              title="La confianza también se comprueba."
              lead="Calcule la huella de un archivo y compárela con una huella de referencia. Sin cuenta y sin enviar su archivo."
              className={section.headingStacked}
            />
            <p className={styles.privacy}>
              <EscudoVistoIcon size={24} aria-hidden="true" />
              El archivo permanece en su dispositivo.
            </p>
            <p className={styles.scope}>
              Esta comparación comprueba si las huellas coinciden. No valida
              sellos de tiempo ni determina la autenticidad o el valor
              probatorio del contenido.
            </p>
          </div>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              verify();
            }}
            aria-label="Comprobar la huella de un archivo"
          >
            <div className={styles.formHead}>
              <ArchivoBusquedaIcon size={24} aria-hidden="true" />
              <h3>Comprobar un archivo</h3>
              <span>SHA-256</span>
            </div>
            <div className={styles.fileField}>
              <label htmlFor={id}>Archivo que desea comprobar</label>
              <input
                id={id}
                type="file"
                disabled={busy || !supported}
                aria-describedby={id + "-help"}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setHash(null);
                  setError("");
                }}
              />
              <p id={id + "-help"}>
                Cualquier formato, sin límite de tamaño: el cálculo avanza por
                partes en un hilo propio, sin bloquear la página.
              </p>
            </div>
            <Field
              label="Huella de referencia (opcional)"
              value={expected}
              maxLength={66}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setExpected(event.target.value)}
              help="Pegue los 64 caracteres de la huella SHA-256 que quiere comparar."
              error={
                normalized && !validExpected
                  ? "La huella debe tener 64 caracteres del 0 al 9 y de la a a la f."
                  : undefined
              }
            />
            <Button
              type="submit"
              disabled={!file || busy || !supported}
              aria-busy={busy}
            >
              {busy ? "Calculando la huella" : "Calcular y comprobar"}
            </Button>
            {!supported && (
              <p role="alert">
                Su navegador no permite calcular huellas en esta página. Use un
                navegador actualizado con una conexión HTTPS.
              </p>
            )}
            {progress !== null && file && (
              <p role="status">
                Calculando: {Math.round((progress / file.size) * 100)} %
              </p>
            )}
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            {hash && (
              <div
                className={styles.result}
                role="status"
                data-match={matches === null ? "none" : String(matches)}
              >
                <p className={styles.resultTitle}>
                  {matches === null
                    ? "Huella calculada"
                    : matches
                      ? "Las huellas coinciden"
                      : "Las huellas no coinciden"}
                </p>
                <code>{hash}</code>
                <p>
                  {matches === null
                    ? "Añada una huella de referencia válida para compararlas."
                    : matches
                      ? "El archivo seleccionado tiene la misma huella que la referencia indicada."
                      : "Compruebe que eligió el archivo y la referencia correctos."}
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
