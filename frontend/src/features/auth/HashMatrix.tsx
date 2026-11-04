import { useEffect, useState } from "react";

import styles from "./HashMatrix.module.css";

type HashMatrixProps = {
  /** Texto del que se calcula la huella. */
  source: string;
  /** De qué datos sale la huella, tal como lo lee la persona: "su nombre", por ejemplo. */
  sourceLabel: string;
  /** Cuando el acta ya se envió, la matriz queda fija con esa hora. */
  receivedAt?: Date | null;
};

type Digest = { hash: string; previous: string };

// Formato de 24 horas: "15:42" no deja dudas sobre la mañana o la tarde.
const TIME = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const LENGTH = 64;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Cuántos caracteres cambiaron entre dos huellas, posición por posición. */
export function changedCharacters(before: string, after: string): number {
  let changed = 0;
  for (let index = 0; index < after.length; index += 1) {
    if (before[index] !== after[index]) changed += 1;
  }
  return changed;
}

// Huella SHA-256 en vivo, como una matriz de 8 × 8: un carácter por casilla, con un tono que
// sube con su valor. Cada vez que el texto cambia, las casillas que cambiaron giran y el
// contador dice cuántas fueron. La afirmación de la pantalla queda demostrada a la vista, con
// los datos de la persona y sin enviar nada: se calcula en el navegador.
export function HashMatrix({
  source,
  sourceLabel,
  receivedAt,
}: HashMatrixProps) {
  const [{ hash, previous }, setDigest] = useState<Digest>({
    hash: "",
    previous: "",
  });

  useEffect(() => {
    let current = true;
    void sha256Hex(source).then((value) => {
      if (!current) return;
      setDigest((before) =>
        before.hash === value ? before : { hash: value, previous: before.hash },
      );
    });
    return () => {
      current = false;
    };
  }, [source]);

  const changed = previous ? changedCharacters(previous, hash) : null;

  return (
    <figure
      className={styles.figure}
      data-received={receivedAt ? "true" : undefined}
    >
      <div className={styles.matrix} aria-hidden="true">
        {Array.from({ length: LENGTH }, (_, index) => {
          const char = hash[index] ?? "";
          const moved = previous !== "" && previous[index] !== char;
          return (
            <span
              // La clave incluye el carácter: una casilla que cambia se monta de nuevo y su
              // giro arranca otra vez, escalonado según su posición.
              key={`${index}-${char}`}
              className={moved ? `${styles.cell} ${styles.moved}` : styles.cell}
              data-value={char === "" ? undefined : parseInt(char, 16)}
            >
              {char}
            </span>
          );
        })}
      </div>

      <figcaption className={styles.caption}>
        <p className={styles.count}>
          {receivedAt ? (
            <>Acta recibida a las {TIME.format(receivedAt)}.</>
          ) : changed === null ? (
            <>Escriba {sourceLabel} y mire la huella.</>
          ) : (
            <>
              Su último cambio movió <strong>{changed}</strong> de los 64
              caracteres.
            </>
          )}
        </p>
        <p className={styles.note}>
          Huella SHA-256 de {sourceLabel}, calculada en su navegador. Con una
          huella así se comprueba que un archivo no cambió: si cambia un solo
          byte, la huella ya no coincide.
        </p>
        <p className="visually-hidden">Huella actual: {hash}</p>
      </figcaption>
    </figure>
  );
}
