import { useId } from "react";

import { formatFilingNumber } from "./filingNumber.ts";
import styles from "./OpeningRecordPreview.module.css";
import { LlaveIcon } from "../../components/ui/icons.tsx";

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
      ? `Sin radicado, referencia interna ${internalReference}`
      : "Sin radicado";

  return (
    <section className={styles.preview} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.label}>
        Así quedará el registro de apertura
      </h2>
      <article className={styles.record} data-ready={ready || undefined}>
        <p className={styles.reference} translate="no">
          {reference}
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
            <p className={styles.eventName}>Caso creado</p>
            <p className={styles.eventNote}>
              Es el evento 1 de la cadena. Queda con la hora del servidor, en
              hora de Colombia.
            </p>
            <dl className={styles.hashes}>
              <div>
                <dt>Huella anterior</dt>
                <dd>
                  <code translate="no">{GENESIS_PREFIX}</code>, porque es el
                  inicio de la cadena
                </dd>
              </div>
              <div>
                <dt>Huella del evento</dt>
                <dd>Se calcula al abrir el caso</dd>
              </div>
            </dl>
          </div>
        </div>
        <p className={styles.key}>
          <LlaveIcon size={16} aria-hidden="true" />
          <span>
            Este caso tiene su propia llave de cifrado. Se guarda cifrada con
            una llave maestra que está fuera de la base de datos.
          </span>
        </p>
      </article>
      <p className={styles.footnote}>
        El registro de apertura es el primer eslabón. Todo lo que se haga
        después en el caso se encadena a él. ALETHEIA documenta la preservación;
        valorar la prueba le corresponde al juez.
      </p>
    </section>
  );
}
