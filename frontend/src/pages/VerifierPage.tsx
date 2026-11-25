import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { ROUTES } from "../config/routes.ts";
import { SIGN_UP_LABEL, TRIAL_DAYS } from "../config/site.ts";
import {
  parseManifest,
  type PreservationManifest,
} from "../features/verifier/manifest.ts";
import { CabeceraSeo } from "../seo/CabeceraSeo.tsx";
import { PAGINAS } from "../seo/fichas.ts";
import styles from "./VerifierPage.module.css";

import { useFileHash } from "../features/verifier/useFileHash.ts";

export function VerifierPage() {
  const [manifest, setManifest] = useState<PreservationManifest | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const hash = useFileHash();
  const manifestRead = useRef(0);
  const selected = manifest?.evidences.find((item) => item.id === selectedId);

  useEffect(
    () => () => {
      manifestRead.current += 1;
    },
    [],
  );

  function clearRun() {
    hash.reset();
    setError("");
  }

  async function loadManifest(chosen: File | undefined) {
    clearRun();
    const read = ++manifestRead.current;
    setManifest(null);
    setSelectedId("");
    if (!chosen) return;
    if (chosen.size > 10 * 1024 * 1024) {
      setError("El manifiesto supera el límite de lectura de 10 MB.");
      return;
    }
    try {
      const text = await chosen.text();
      if (read !== manifestRead.current) return;
      const parsed = parseManifest(text);
      setManifest(parsed);
      if (parsed.evidences.length === 1) setSelectedId(parsed.evidences[0].id);
    } catch (reason) {
      if (read !== manifestRead.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo leer el manifiesto.",
      );
    }
  }

  function verify() {
    if (!file || !selected) return;
    setError("");
    if (file.size !== selected.size_bytes) {
      hash.reset();
      setError(
        `El tamaño difiere del manifiesto (${selected.size_bytes.toLocaleString("es-CO")} bytes esperados). Seleccione el archivo correspondiente.`,
      );
      return;
    }
    hash.start(file);
  }

  return (
    <>
      <CabeceraSeo meta={PAGINAS.verificador} />
      <section className={styles.page} aria-labelledby="verificador-titulo">
        <div className={styles.inner}>
          <header className={styles.intro}>
            <h1 id="verificador-titulo">
              Compare un archivo con su manifiesto.
            </h1>
            <p>
              Seleccione el manifiesto del paquete de preservación y el archivo
              que desea comprobar. El cálculo ocurre en este navegador; ninguno
              de los dos archivos se envía a ALETHEIA.
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
            <Button
              type="button"
              onClick={verify}
              disabled={!selected || !file || hash.progress !== null}
            >
              Comparar huellas
            </Button>
            {hash.progress !== null && (
              <p role="status">Calculando: {hash.progress} %</p>
            )}
            {(error || hash.failed) && (
              <p className={styles.error} role="alert">
                {error || "No se pudo calcular la huella. Inténtelo de nuevo."}
              </p>
            )}
          </div>

          {hash.digest && selected && (
            <section className={styles.result} aria-live="polite">
              <h2>
                {hash.digest === selected.sha256
                  ? "Las huellas coinciden"
                  : "Las huellas no coinciden"}
              </h2>
              <dl>
                <dt>Huella del manifiesto</dt>
                <dd>{selected.sha256}</dd>
                <dt>Huella calculada</dt>
                <dd>{hash.digest}</dd>
              </dl>
              <div className={styles.next}>
                <p>
                  Para conservar sus propios archivos con su sello de tiempo y
                  su cadena de custodia, y entregarlos en un paquete como este,
                  abra un caso en ALETHEIA. La prueba dura {TRIAL_DAYS} días y
                  no pide tarjeta.
                </p>
                <ButtonLink to={ROUTES.signUp} variant="secondary" size="sm">
                  {SIGN_UP_LABEL}
                </ButtonLink>
              </div>
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
