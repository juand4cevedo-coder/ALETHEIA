import { useState } from "react";

import { buttonClassName } from "../../components/ui/buttonStyles.ts";
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

/** Demostración de la huella: una sola letra distinta cambia toda la huella SHA-256. La huella
 * se calcula de verdad en el navegador de quien escribe, por eso el resultado sí usa el verde. */
export function HashDemo() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const { hash, supported } = useSha256(text, SAMPLE_HASH);
  const matches = hash === SAMPLE_HASH;
  const state = !supported ? "unsupported" : matches ? "match" : "mismatch";

  return (
    <div className={styles.panel}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="hash-demo-text">
          Texto de ejemplo
        </label>
        <textarea
          id="hash-demo-text"
          className={styles.textarea}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          aria-describedby="hash-demo-ayuda"
          // Sin cálculo disponible, editar dejaría la «Huella actual» desfasada del texto.
          readOnly={!supported}
          spellCheck={false}
        />
        <p id="hash-demo-ayuda" className={styles.helper}>
          Cambie una sola letra y compare las dos huellas.
        </p>
      </div>

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
        <p role="status" className={styles.status} data-state={state}>
          {supported && <i className={styles.dot} aria-hidden="true" />}
          {!supported
            ? "Su navegador no permite recalcular la huella en esta página."
            : matches
              ? "Coincide"
              : "No coincide"}
        </p>
        <button
          type="button"
          className={buttonClassName({ variant: "secondary", size: "sm" })}
          onClick={() => setText(SAMPLE_TEXT)}
        >
          Restaurar el texto
        </button>
      </div>
    </div>
  );
}
