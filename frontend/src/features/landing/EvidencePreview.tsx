import {
  BadgeCheck,
  Clock3,
  FileArchive,
  Fingerprint,
  Lock,
} from "lucide-react";

import { Hash } from "../../components/ui/Hash.tsx";
import styles from "./EvidencePreview.module.css";

// Huella real de un texto de ejemplo, para que la vista muestre un valor con la forma exacta
// de una SHA-256.
const EXAMPLE_HASH =
  "52a910d44b570bc5cd4d35e1c7420d0d05c2920518d70b61b6f04595b5b9a6f5";

const CUSTODY = [
  { time: "10:39:04", text: "Laura Gómez subió el archivo original" },
  { time: "10:39:05", text: "Se registró la huella SHA-256" },
  { time: "10:39:07", text: "La autoridad externa emitió el sello de tiempo" },
  { time: "11:02:41", text: "Andrés Ruiz consultó la evidencia" },
] as const;

// Vista de una evidencia preservada, como se verá en el espacio de trabajo. Los datos son
// ficticios; las filas y los eventos aparecen en orden al cargar la portada.
export function EvidencePreview() {
  return (
    <figure className={styles.window}>
      <div className={styles.toolbar}>
        <span className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={styles.path}>
          Caso 2026-014 · Laboral <span aria-hidden="true">/</span> Evidencias
        </span>
        <span className={styles.status}>
          <BadgeCheck size={14} />
          Preservada
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.main}>
          <div className={styles.file}>
            <span className={styles.fileIcon}>
              <FileArchive size={22} />
            </span>
            <div>
              <p className={styles.fileName}>chat_cliente.zip</p>
              <p className={styles.fileMeta}>
                Chat exportado de WhatsApp · 2,4 MB · Recibido el 15/10/2026
              </p>
            </div>
          </div>

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>
                <Fingerprint size={15} />
                Huella SHA-256
              </dt>
              <dd className={styles.hash}>
                <Hash value={EXAMPLE_HASH} copyable={false} />
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <Clock3 size={15} />
                Sello de tiempo
              </dt>
              <dd>
                15/10/2026, 10:39:07 (hora de Colombia)
                <span className={styles.factNote}>
                  Autoridad de sellado externa · RFC 3161
                </span>
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <Lock size={15} />
                Cifrado
              </dt>
              <dd>
                AES-256-GCM
                <span className={styles.factNote}>Llave propia del caso</span>
              </dd>
            </div>
          </dl>
        </div>

        <div className={styles.aside}>
          <p className={styles.asideTitle}>Cadena de custodia</p>
          <ol className={styles.timeline}>
            {CUSTODY.map((event) => (
              <li key={event.time} className={styles.event}>
                <time className={styles.eventTime}>{event.time}</time>
                <span>{event.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <figcaption className={styles.caption}>
        Vista ilustrativa con datos ficticios
      </figcaption>
    </figure>
  );
}
