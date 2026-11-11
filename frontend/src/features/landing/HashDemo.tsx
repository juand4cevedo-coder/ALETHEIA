import { useState } from "react";

import styles from "./HashDemo.module.css";
import { useSha256 } from "./useSha256.ts";

export const SAMPLE_TEXT = "Acepto la oferta y firmo el contrato el lunes.";
export const SAMPLE_HASH =
  "2423c674b991b77295651978758e9e384f3215d43e83daef9643fb9fd193254e";

/** Parte la huella en 8 bloques de 8 y marca cada carácter que difiere de la registrada. */
function FingerprintBlocks({ hash }: { hash: string }) {
  const blocks = Array.from({ length: 8 }, (_, i) => i * 8);
  return (
    <>
      <span className="visually-hidden">{hash}</span>
      <span className={styles.blocks} aria-hidden="true">
        {blocks.map((start) => (
          <span key={start}>
            {Array.from(hash.slice(start, start + 8), (char, i) => (
              <span
                key={i}
                className={
                  char === SAMPLE_HASH[start + i] ? undefined : styles.changed
                }
              >
                {char}
              </span>
            ))}
          </span>
        ))}
      </span>
    </>
  );
}

/** Demostración A: una sola letra distinta cambia toda la huella SHA-256. */
export function HashDemo() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const { hash, supported } = useSha256(text, SAMPLE_HASH);
  const matches = hash === SAMPLE_HASH;

  return (
    <div className={`${styles.demo} ${styles.panel}`}>
      <label className={styles.label} htmlFor="hash-demo-text">
        Texto de ejemplo
      </label>
      <p className={styles.helper}>
        Cambie una sola letra y compare las huellas.
      </p>
      <textarea
        id="hash-demo-text"
        className={styles.textarea}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        // Sin cálculo disponible, editar dejaría la «Huella actual» desfasada del texto.
        readOnly={!supported}
        spellCheck={false}
      />

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>Huella registrada</dt>
          <dd>
            <FingerprintBlocks hash={SAMPLE_HASH} />
          </dd>
        </div>
        <div className={styles.row}>
          <dt>Huella actual</dt>
          <dd>
            <FingerprintBlocks hash={hash} />
          </dd>
        </div>
      </dl>

      <div className={styles.footer}>
        <p
          role="status"
          className={
            !supported
              ? styles.notice
              : matches
                ? styles.match
                : styles.mismatch
          }
        >
          {!supported
            ? "Su navegador no permite recalcular la huella en esta página."
            : matches
              ? "Coincide"
              : "No coincide"}
        </p>
        <button
          type="button"
          className={styles.restore}
          onClick={() => setText(SAMPLE_TEXT)}
        >
          Restaurar el texto
        </button>
      </div>
    </div>
  );
}
