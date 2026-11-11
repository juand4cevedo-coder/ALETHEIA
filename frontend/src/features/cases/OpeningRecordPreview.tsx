import { KeyRound } from "lucide-react";
import { useId } from "react";

import { formatFilingNumber } from "./filingNumber.ts";
import styles from "./OpeningRecordPreview.module.css";

type OpeningRecordPreviewProps = {
  title: string;
  /** Dígitos del radicado, solo si ya son los 23; si no, la vista previa no lo muestra. */
  filingNumber?: string;
  internalReference?: string;
  practiceArea?: string;
  court?: string;
  openedBy: string;
  organization: string;
  /** Los datos obligatorios están completos y el caso se puede abrir. */
  ready: boolean;
};

const NOT_GIVEN = "Sin especificar";
// Huella anterior del primer evento: 32 bytes en cero (GENESIS_HASH en el backend). Se muestran
// los primeros 16 caracteres, como en el resto de huellas abreviadas.
const GENESIS_PREFIX = "0000000000000000";

// Vista previa del registro de apertura (HU-015, maqueta 02): enseña, mientras la persona
// escribe, qué queda registrado al abrir el caso. No es una región viva: leerla en cada tecla
// interrumpiría al lector de pantalla; está junto al formulario para consultarla cuando se quiera.
export function OpeningRecordPreview({
  title,
  filingNumber,
  internalReference,
  practiceArea,
  court,
  openedBy,
  organization,
  ready,
}: OpeningRecordPreviewProps) {
  const headingId = useId();
  const reference = filingNumber
    ? formatFilingNumber(filingNumber)
    : internalReference
      ? `Sin radicado · ref. interna ${internalReference}`
      : "Sin radicado";

  return (
    <section className={styles.preview} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.label}>
        Así quedará el registro de apertura
      </h2>
      <article className={styles.record} data-ready={ready || undefined}>
        <p className={styles.reference} translate="no">
          {`CASO · ${reference}`}
        </p>
        <h3 className={styles.title} data-empty={!title || undefined}>
          {title || "Título del caso"}
        </h3>
        <dl className={styles.facts}>
          <div>
            <dt>Especialidad</dt>
            <dd>{practiceArea || NOT_GIVEN}</dd>
          </div>
          <div>
            <dt>Despacho</dt>
            <dd>{court || NOT_GIVEN}</dd>
          </div>
          <div>
            <dt>Abre</dt>
            <dd>{openedBy}</dd>
          </div>
          <div>
            <dt>Organización</dt>
            <dd>{organization}</dd>
          </div>
        </dl>
        <div className={styles.genesis}>
          <span className={styles.node} aria-hidden="true" />
          <div className={styles.event}>
            <p className={styles.eventName}>Evento 1 · Caso creado</p>
            <p className={styles.eventNote}>
              Se registrará con la hora del servidor, en hora de Colombia
              (UTC−5).
            </p>
            <dl className={styles.hashes}>
              <div>
                <dt>Hash anterior</dt>
                <dd>
                  <code translate="no">{GENESIS_PREFIX}</code> · inicio de la
                  cadena
                </dd>
              </div>
              <div>
                <dt>Hash del evento</dt>
                <dd>se calcula al abrir el caso</dd>
              </div>
            </dl>
          </div>
        </div>
        <p className={styles.key}>
          <KeyRound size={16} aria-hidden="true" />
          <span>Llave de cifrado propia, AES-256-GCM, guardada envuelta</span>
          <code translate="no">KMS</code>
        </p>
      </article>
      <p className={styles.footnote}>
        El registro de apertura es el primer eslabón: todo lo que se haga
        después en el caso se encadena a él. ALETHEIA documenta la preservación;
        la valoración de la prueba corresponde al juez.
      </p>
    </section>
  );
}
