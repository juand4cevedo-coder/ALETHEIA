import { buttonClassName } from "../../components/ui/buttonStyles.ts";
import { Hash } from "../../components/ui/Hash.tsx";
import styles from "./EvidencePreview.module.css";
import {
  ArchivoComprimidoIcon,
  CadenaIcon,
  HuellaIcon,
  PaqueteIcon,
  SelloIcon,
  SubirIcon,
} from "../../components/ui/icons.tsx";

// Huella real de un texto de ejemplo, para que la vista muestre un valor con la forma exacta
// de una SHA-256. La ficha del sello (StampCard) muestra la misma.
const EXAMPLE_HASH =
  "52a910d44b570bc5cd4d35e1c7420d0d05c2920518d70b61b6f04595b5b9a6f5";

const CUSTODY = [
  { time: "10:39:04 a. m.", text: "Laura Gómez subió el archivo original" },
  { time: "10:39:05 a. m.", text: "Se registró la huella SHA-256" },
  {
    time: "10:39:07 a. m.",
    text: "La autoridad externa emitió el sello de tiempo",
  },
  { time: "11:02:41 a. m.", text: "Andrés Ruiz consultó la evidencia" },
] as const;

// Una evidencia como se ve en la aplicación: el original, su huella, el sello, el paquete y la
// cadena de custodia. Cada fila lleva el ícono del paso de Cómo funciona que la produce.
export function EvidencePreview() {
  return (
    <figure className={styles.window} aria-label="Ejemplo de una evidencia">
      <div className={styles.head}>
        <span className={styles.fileIcon}>
          <ArchivoComprimidoIcon size={20} aria-hidden="true" />
        </span>
        <div className={styles.file}>
          <p className={styles.case}>Despido sin justa causa, Torres</p>
          <p className={styles.fileName} translate="no">
            chat_cliente.zip
          </p>
          <p className={styles.fileMeta}>Chat de WhatsApp exportado, 2,4 MB</p>
        </div>
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>
            <SubirIcon size={16} aria-hidden="true" />
            Original
          </dt>
          <dd>
            Recibido el 15 de octubre de 2026, 10:39 a. m.
            <span className={styles.note}>Cifrado con la llave del caso</span>
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>
            <HuellaIcon size={16} aria-hidden="true" />
            Huella SHA-256
          </dt>
          <dd className={styles.hash}>
            <Hash value={EXAMPLE_HASH} copyable={false} />
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>
            <SelloIcon size={16} aria-hidden="true" />
            Sello de tiempo
          </dt>
          <dd>
            15 de octubre de 2026, 10:39:07 a. m. (hora de Colombia)
            <span className={styles.note}>
              Autoridad de sellado externa, RFC 3161
            </span>
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>
            <PaqueteIcon size={16} aria-hidden="true" />
            Paquete
          </dt>
          <dd className={styles.package}>
            <span>
              Originales, huellas, sellos e informe de custodia en PDF
            </span>
            {/* Es una imagen del botón, no un control: no se enfoca ni se anuncia. */}
            <span
              className={buttonClassName({ variant: "secondary", size: "sm" })}
              aria-hidden="true"
            >
              Exportar el paquete
            </span>
          </dd>
        </div>
      </dl>

      <div className={styles.custody}>
        <p className={styles.custodyTitle}>
          <CadenaIcon size={16} aria-hidden="true" />
          Cadena de custodia
        </p>
        <ol className={styles.events}>
          {CUSTODY.map((event) => (
            <li key={event.time} className={styles.event}>
              <span className={styles.eventTime}>{event.time}</span>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
