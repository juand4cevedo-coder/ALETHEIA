import { Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";

import styles from "./IntegrityPreview.module.css";

type IntegrityPreviewProps = {
  fullName: string;
  organizationName: string;
};

const NAME_PLACEHOLDER = "Su nombre";
const ORGANIZATION_PLACEHOLDER = "Su oficina o firma";

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

// Prueba de integridad en vivo, al lado del registro: la huella SHA-256 de lo que la persona
// escribe cambia por completo con una sola letra. Es la idea central del producto, contada con
// sus propios datos. Se calcula en el navegador y no se envía a ninguna parte.
export function IntegrityPreview({
  fullName,
  organizationName,
}: IntegrityPreviewProps) {
  const responsible = fullName.trim() || NAME_PLACEHOLDER;
  const organization = organizationName.trim() || ORGANIZATION_PLACEHOLDER;
  // La huella anterior se guarda junto a la actual para marcar los caracteres que cambiaron.
  const [{ hash, previous }, setDigest] = useState({ hash: "", previous: "" });

  useEffect(() => {
    let current = true;
    void sha256Hex(`${responsible}\n${organization}`).then((value) => {
      if (current)
        setDigest((before) => ({ hash: value, previous: before.hash }));
    });
    return () => {
      current = false;
    };
  }, [responsible, organization]);

  return (
    <figure className={styles.record}>
      <figcaption className={styles.head}>
        <h2 className={styles.title}>Una letra distinta, otra huella</h2>
        <p className={styles.lead}>
          Escriba su nombre o el de su oficina y mire la huella SHA-256. Con
          ella ALETHEIA demuestra que una evidencia no cambió desde que la
          recibió.
        </p>
      </figcaption>

      <dl className={styles.fields}>
        <div className={styles.field}>
          <dt>Responsable</dt>
          <dd data-empty={fullName.trim() ? undefined : "true"}>
            {responsible}
          </dd>
        </div>
        <div className={styles.field}>
          <dt>Oficina</dt>
          <dd data-empty={organizationName.trim() ? undefined : "true"}>
            {organization}
          </dd>
        </div>
        <div className={`${styles.field} ${styles.hashField}`}>
          <dt>
            <Fingerprint size={15} aria-hidden="true" />
            Huella SHA-256
          </dt>
          <dd>
            <code className={styles.hash}>
              <span className="visually-hidden">{hash}</span>
              <span className={styles.digits} aria-hidden="true">
                {hash.split("").map((char, index) => (
                  <span
                    // La clave incluye el carácter: si cambia, el elemento se monta de nuevo y
                    // su animación muestra qué parte de la huella se movió.
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
          </dd>
        </div>
      </dl>

      <p className={styles.note}>
        Calculada en su navegador. Estos datos no salen de aquí hasta que cree
        la cuenta.
      </p>
    </figure>
  );
}
