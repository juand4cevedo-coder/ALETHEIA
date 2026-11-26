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
import { FaqList, type FaqItem } from "../features/landing/FaqSection.tsx";
import { VerifierSection } from "../features/landing/VerifierSection.tsx";
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
            <h1 id="verificador-titulo">Compruebe que un archivo no cambió</h1>
            <p>
              Elija un archivo y compárelo con el que se guardó en ALETHEIA o
              con el informe de un expediente. Todo pasa en este navegador: el
              archivo no se envía a ninguna parte y no necesita una cuenta.
            </p>
          </header>
        </div>
      </section>

      <VerifierSection />

      <section className={styles.page} aria-labelledby="manifiesto-titulo">
        <div className={styles.inner}>
          <header className={styles.intro}>
            <h2 id="manifiesto-titulo">
              Compare un archivo con el manifiesto de su paquete
            </h2>
            <p>
              Si recibió un paquete de preservación de ALETHEIA, elija su
              manifest.json y el archivo que quiere revisar. El comprobador lee
              la huella registrada y la compara con la del archivo.
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

      <section className={styles.page} aria-labelledby="sin-comprobador">
        <div className={styles.inner}>
          <div className={styles.prose}>
            <h2 id="sin-comprobador">Calcularla sin este comprobador</h2>
            <p>
              SHA-256 es un estándar, así que cualquier programa que lo use da
              la misma huella para el mismo archivo. Su computador ya trae uno.
              Abra la terminal en la carpeta del archivo y cambie{" "}
              <code>archivo.pdf</code> por su nombre:
            </p>
            <dl className={styles.commands}>
              {COMMANDS.map(([system, command]) => (
                <div key={system}>
                  <dt>{system}</dt>
                  <dd>
                    <pre>
                      <code>{command}</code>
                    </pre>
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              Para revisar además el sello de tiempo de un archivo, siga la guía{" "}
              <Link to="/docs/revisar-un-sello-de-tiempo">
                Revisar un sello de tiempo con OpenSSL
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className={styles.page} aria-labelledby="preguntas-comprobador">
        <div className={styles.inner}>
          <h2 id="preguntas-comprobador" className={styles.faqTitle}>
            Preguntas sobre el comprobador
          </h2>
          <FaqList items={QUESTIONS} />
          <div className={styles.closing}>
            <p>
              Para que su propia evidencia quede con huella, sello de tiempo y
              cadena de custodia desde el día en que la recibe, abra un caso en
              ALETHEIA. La prueba dura {TRIAL_DAYS} días y no pide tarjeta.
            </p>
            <ButtonLink to={ROUTES.signUp}>{SIGN_UP_LABEL}</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

const COMMANDS = [
  ["Windows (PowerShell)", "Get-FileHash archivo.pdf -Algorithm SHA256"],
  ["macOS", "shasum -a 256 archivo.pdf"],
  ["Linux", "sha256sum archivo.pdf"],
] as const;

const QUESTIONS: FaqItem[] = [
  {
    question: "¿Qué es un hash SHA-256?",
    answer:
      "Es un código de 64 caracteres que se calcula a partir del contenido de un archivo. El mismo contenido siempre da el mismo código, y cambiar un solo byte da uno distinto. Por eso sirve para saber si dos archivos son iguales sin abrirlos.",
  },
  {
    question: "¿El archivo se sube a algún servidor?",
    answer:
      "No. El cálculo lo hace su navegador, en su equipo. ALETHEIA no recibe el archivo, su nombre ni su huella.",
  },
  {
    question: "¿Hay un límite de tamaño?",
    answer:
      "No. El comprobador lee el archivo por partes, en segundo plano, así que puede revisar videos o archivos grandes sin que la página se bloquee. Archivos muy grandes tardan más.",
  },
  {
    question: "¿Qué prueba que dos huellas coincidan?",
    answer:
      "Que el contenido es el mismo, byte por byte. No dice quién creó el archivo, cuándo, ni si es auténtico o admisible como prueba. Esa valoración le corresponde al juez.",
  },
  {
    question: "¿Cómo consigo un paquete con huella, sello y custodia?",
    answer:
      "Subiendo la evidencia a un caso en ALETHEIA. Cada archivo queda con su huella SHA-256, un sello de tiempo RFC 3161 y su cadena de custodia, y el caso se exporta en un paquete que se comprueba aquí.",
  },
];
