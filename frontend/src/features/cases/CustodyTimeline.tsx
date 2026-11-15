import type {
  CustodyEventOut,
  CustodyVerificationOut,
} from "../../api/generated";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { custodyActionLabel } from "./custodyActions.ts";
import { formatColombiaTime } from "./dates.ts";
import styles from "./CustodyTimeline.module.css";

/** Los primeros 12 caracteres en bloques de 4 y los últimos 4, con un trazo punteado entre
 * ambos en lugar de puntos suspensivos. Basta para reconocer un evento a simple vista; la huella
 * completa queda para el lector de pantalla. */
function abbreviateHash(hash: string): { head: string; tail: string } {
  const value = hash.toLowerCase();
  const head = value.slice(0, 12).match(/.{1,4}/g) ?? [];
  return { head: head.join(" "), tail: value.slice(-4) };
}

type CustodyTimelineProps = {
  /** Eventos del más reciente al más antiguo, como los entrega la API. */
  events: CustodyEventOut[];
  /** Resalta el primer eslabón una vez, al llegar recién abierto el caso. */
  justOpened?: boolean;
  verification?: CustodyVerificationOut | null;
};

// Cadena de custodia del caso (maqueta 03): cada evento con su número, quién lo hizo, la hora
// exacta en Colombia y su huella abreviada, y al final el hueco del siguiente eslabón.
export function CustodyTimeline({
  events,
  justOpened = false,
  verification = null,
}: CustodyTimelineProps) {
  const chronological = [...events].sort((a, b) => a.seq - b.seq);
  const last = chronological.at(-1);

  return (
    <div className={styles.timeline} data-just-opened={justOpened || undefined}>
      <ol className={styles.events} aria-label="Eventos de la cadena">
        {chronological.map((event) => (
          <li
            key={event.seq}
            className={styles.event}
            aria-label={`Evento ${event.seq}`}
          >
            <span className={styles.node} aria-hidden="true" />
            <div className={styles.body}>
              <p className={styles.name}>{custodyActionLabel(event.action)}</p>
              <p className={styles.meta}>
                {`${event.actor_name ?? "Sistema"}, `}
                <time dateTime={event.occurred_at}>
                  {formatColombiaTime(event.occurred_at, { seconds: true })}
                </time>
              </p>
              <p className={styles.hash}>
                <span className={styles.hashLabel} aria-hidden="true">
                  {`#${event.seq}`}
                </span>
                <span className="visually-hidden">Huella del evento:</span>{" "}
                <code translate="no">
                  <span aria-hidden="true">
                    {`${abbreviateHash(event.event_hash).head} `}
                    <span className={styles.elision} />
                    {abbreviateHash(event.event_hash).tail}
                  </span>
                  <span className="visually-hidden">
                    {event.event_hash.toLowerCase()}
                  </span>
                </code>
              </p>
            </div>
          </li>
        ))}
      </ol>

      {last && (
        <div className={styles.next}>
          <span className={styles.ghost} aria-hidden="true" />
          <div className={styles.body}>
            <p className={styles.nextName}>Siguiente eslabón</p>
            <p className={styles.meta}>
              {`Lo próximo que ocurra en el caso se encadenará al evento #${last.seq}.`}
            </p>
          </div>
        </div>
      )}

      <div className={styles.verification} role="status" aria-live="polite">
        {verification === null ? (
          <>
            <StatusBadge tone="muted">Sin verificar</StatusBadge>
            <p>La cadena todavía no se ha recalculado en esta visita.</p>
          </>
        ) : verification.intact ? (
          <>
            <StatusBadge tone="ok">Integridad comprobada</StatusBadge>
            <p>
              {`Coinciden los ${verification.events_checked} eventos guardados. Esta comprobación no incluye un anclaje externo.`}
            </p>
          </>
        ) : (
          <>
            <StatusBadge tone="error">Cadena alterada</StatusBadge>
            <p>{`La cadena no cierra en el evento #${verification.broken_at ?? 1}. Revise el historial antes de usarlo.`}</p>
          </>
        )}
      </div>
    </div>
  );
}
