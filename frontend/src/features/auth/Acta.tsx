import { type ReactNode, useEffect, useState } from "react";

import markUrl from "../../assets/aletheia-mark.png";
import { SITE_NAME } from "../../config/site.ts";
import styles from "./Acta.module.css";

type ActaProps = {
  titleId: string;
  title: string;
  /** Texto que identifica el acta; su huella SHA-256 se muestra al pie. */
  fingerprint: string;
  children: ReactNode;
  /** Sello que se estampa cuando el acta se envió, con la hora de la estampa. */
  seal?: { label: string; at: Date } | null;
};

const DATE = new Intl.DateTimeFormat("es-CO", { dateStyle: "long" });
const TIME = new Intl.DateTimeFormat("es-CO", { timeStyle: "short" });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

// Acta de las pantallas de acceso: una hoja de papel de seguridad sobre el fondo oscuro del
// sitio. Lo que la persona escribe queda en los espacios en blanco y la huella SHA-256 del
// acta, al pie, cambia por completo con una sola letra: es la idea central del producto
// contada con sus propios datos. La huella se calcula en el navegador.
export function Acta({
  titleId,
  title,
  fingerprint,
  children,
  seal,
}: ActaProps) {
  const [today] = useState(() => new Date());
  // La huella anterior se guarda junto a la actual para marcar los caracteres que cambiaron.
  const [{ hash, previous }, setDigest] = useState({ hash: "", previous: "" });

  useEffect(() => {
    let current = true;
    void sha256Hex(fingerprint).then((value) => {
      if (current) {
        setDigest((before) => ({ hash: value, previous: before.hash }));
      }
    });
    return () => {
      current = false;
    };
  }, [fingerprint]);

  return (
    <article className={styles.paper} aria-labelledby={titleId}>
      <header className={styles.head}>
        <span className={styles.issuer}>
          <img src={markUrl} alt="" width={21} height={20} />
          {SITE_NAME}
        </span>
        <h1 id={titleId} className={styles.title}>
          {title}
        </h1>
        <time className={styles.date} dateTime={today.toISOString()}>
          {DATE.format(today)}
        </time>
      </header>

      <div className={styles.body}>{children}</div>

      <footer className={styles.foot}>
        <p className={styles.footLabel}>Huella del acta (SHA-256)</p>
        <code className={styles.hash}>
          <span className="visually-hidden">{hash}</span>
          <span className={styles.digits} aria-hidden="true">
            {hash.split("").map((char, index) => (
              <span
                // La clave incluye el carácter: si cambia, el elemento se monta de nuevo y su
                // animación muestra qué parte de la huella se movió.
                key={`${index}-${char}`}
                className={
                  previous && previous[index] !== char
                    ? styles.changed
                    : undefined
                }
              >
                {char}
              </span>
            ))}
          </span>
        </code>
        <p className={styles.footNote}>
          Cambie una sola letra del acta y la huella cambia por completo: así
          detecta ALETHEIA cualquier alteración en una evidencia. Se calcula en
          su navegador.
        </p>
      </footer>

      {seal && (
        <p className={styles.seal}>
          <span className={styles.sealLabel}>{seal.label}</span>
          <time dateTime={seal.at.toISOString()}>
            {DATE.format(seal.at)}
            <br />
            {TIME.format(seal.at)}
          </time>
        </p>
      )}
    </article>
  );
}
