import type { CustodyEventOut } from "../../api/generated";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { formatColombiaTime } from "./dates.ts";
import styles from "./CustodyTimeline.module.css";

// Nombre de cada acción de la cadena tal como lo lee la persona. Una acción que todavía no
// tenga nombre aquí se muestra con su código, nunca se oculta.
const ACTION_LABELS: Record<string, string> = {
  case_created: "Caso creado",
};

/** "9f2c 71d0 b8e4 … a41e": los primeros 12 caracteres en bloques de 4 y los últimos 4. Basta
 * para reconocer un evento a simple vista; la huella completa queda para el lector. */
function abbreviateHash(hash: string): string {
  const value = hash.toLowerCase();
  const head = value.slice(0, 12).match(/.{1,4}/g) ?? [];
  return `${head.join(" ")} … ${value.slice(-4)}`;
}

type CustodyTimelineProps = {
  /** Eventos del más reciente al más antiguo, como los entrega la API. */
  events: CustodyEventOut[];
  /** Resalta el primer eslabón una vez, al llegar recién abierto el caso. */
  justOpened?: boolean;
};

// Cadena de custodia del caso (maqueta 03): cada evento con su número, quién lo hizo, la hora
// exacta en Colombia y su hash abreviado, y al final el hueco del siguiente eslabón. No dice que
// la cadena esté íntegra: eso solo lo puede afirmar el verificador independiente (HU-024).
export function CustodyTimeline({
  events,
  justOpened = false,
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
              <p className={styles.name}>
                {ACTION_LABELS[event.action] ?? event.action}
              </p>
              <p className={styles.meta}>
                {`${event.actor_name ?? "Sistema"} · `}
                <time dateTime={event.occurred_at}>
                  {formatColombiaTime(event.occurred_at, { seconds: true })}
                </time>
              </p>
              <p className={styles.hash}>
                <span aria-hidden="true">{`#${event.seq} · `}</span>
                <span className="visually-hidden">Hash del evento:</span>{" "}
                <code translate="no">
                  <span aria-hidden="true">
                    {abbreviateHash(event.event_hash)}
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

      <div className={styles.verification}>
        <StatusBadge tone="muted">Sin verificar</StatusBadge>
        <p>
          Ningún verificador independiente ha comprobado todavía esta cadena.
        </p>
      </div>
    </div>
  );
}
