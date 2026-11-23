import type {
  CustodyEventDetailOut,
  CustodyEventOut,
  CustodyVerificationOut,
} from "../../api/generated";
import { Hash } from "../../components/ui/Hash.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { ROUTES } from "../../config/routes.ts";
import { custodyActionLabel } from "./custodyActions.ts";
import { formatColombiaTime } from "./dates.ts";
import styles from "./CustodyTimeline.module.css";
import { Link } from "react-router";

/** Un evento de la cadena. Los datos de cotejo (huella anterior, evidencia y detalles) llegan en
 * el listado de la cadena; en otros resúmenes pueden faltar. */
export type TimelineEvent = CustodyEventOut &
  Partial<Pick<CustodyEventDetailOut, "prev_hash" | "evidence_id" | "details">>;

const DETAIL_LABELS: Record<string, string> = {
  sha256: "Huella del archivo",
  size_bytes: "Tamaño",
  tsa_time: "Hora del sello",
  reason: "Motivo",
  export_id: "Paquete",
  manifest_sha256: "Huella del manifiesto",
  link_id: "Enlace",
  expires_at: "Vence",
  retention_until: "Conservar hasta",
  retention_basis: "Fundamento",
  name: "Persona",
  role: "Rol",
};

const TIME_KEYS = new Set(["tsa_time", "expires_at", "retention_until"]);
const HASH_PATTERN = /^[0-9a-f]{64}$/i;
const REASONS: Record<string, string> = {
  no_verifica: "El sello no verificó contra las raíces de la autoridad",
};
const BASES: Record<string, string> = {
  organization_policy: "Política del despacho",
  legal_or_contractual_duty: "Deber legal o contractual",
  litigation_hold: "Bloqueo jurídico por litigio",
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} ${size === 1 ? "byte" : "bytes"}`;
  const unit = size < 1024 * 1024 ? "KB" : size < 1024 ** 3 ? "MB" : "GB";
  const divisor = unit === "KB" ? 1024 : unit === "MB" ? 1024 ** 2 : 1024 ** 3;
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(size / divisor)} ${unit}`;
}

function DetailValue({
  name,
  value,
}: {
  name: string;
  value: string | number;
}) {
  if (typeof value === "string" && HASH_PATTERN.test(value))
    return <Hash value={value} variant="full" />;
  if (name === "size_bytes" && typeof value === "number")
    return <>{formatBytes(value)}</>;
  if (TIME_KEYS.has(name) && typeof value === "string")
    return <>{formatColombiaTime(value, { seconds: true })}</>;
  if (name === "reason" && typeof value === "string")
    return <>{REASONS[value] ?? value}</>;
  if (name === "retention_basis" && typeof value === "string")
    return <>{BASES[value] ?? value}</>;
  return <>{String(value)}</>;
}

/** Lo que hace falta para cotejar un evento: la huella del anterior, la evidencia y lo que se
 * registró. Va plegado: la lista se lee de corrido y el detalle se abre solo si se necesita. */
function EventDetail({
  event,
  caseId,
}: {
  event: TimelineEvent;
  caseId?: string;
}) {
  const entries = Object.entries(event.details ?? {}).filter(
    ([, value]) => value !== null && value !== "",
  ) as [string, string | number][];
  const first = event.seq === 1;
  if (!first && !event.prev_hash && entries.length === 0 && !event.evidence_id)
    return null;
  return (
    <details className={styles.more}>
      <summary>Ver el detalle del evento</summary>
      <dl className={styles.facts}>
        <div>
          <dt>Evento anterior</dt>
          <dd>
            {first || !event.prev_hash ? (
              "Es el primer evento de la cadena: no tiene anterior."
            ) : (
              <Hash value={event.prev_hash} variant="full" />
            )}
          </dd>
        </div>
        {event.evidence_id && caseId && (
          <div>
            <dt>Evidencia</dt>
            <dd>
              <Link to={ROUTES.evidenceDetail(caseId, event.evidence_id)}>
                Abrir la evidencia
              </Link>
            </dd>
          </div>
        )}
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{DETAIL_LABELS[key] ?? key}</dt>
            <dd>
              <DetailValue name={key} value={value} />
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

type CustodyTimelineProps = {
  /** Eventos del más reciente al más antiguo, como los entrega la API. */
  events: TimelineEvent[];
  /** Resalta el primer eslabón una vez, al llegar recién abierto el caso. */
  justOpened?: boolean;
  caseId?: string;
  /** Si se muestra el hueco del siguiente eslabón: no tiene sentido con un filtro puesto. */
  showNext?: boolean;
};

// Cadena de custodia del caso (maqueta 03): cada evento con su número, quién lo hizo, la hora
// exacta en Colombia y su huella completa y copiable, con el detalle plegado; y al final el hueco
// del siguiente eslabón.
export function CustodyTimeline({
  events,
  justOpened = false,
  caseId,
  showNext = true,
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
              <div className={styles.head}>
                <p className={styles.name}>
                  {custodyActionLabel(event.action)}
                </p>
                <span className={styles.seq} aria-hidden="true">
                  {`#${event.seq}`}
                </span>
              </div>
              <p className={styles.meta}>
                {`${event.actor_name ?? "Sistema"}, `}
                <time dateTime={event.occurred_at}>
                  {formatColombiaTime(event.occurred_at, { seconds: true })}
                </time>
              </p>
              <div className={styles.hash} translate="no">
                <span className={styles.hashLabel}>Huella SHA-256</span>
                <Hash value={event.event_hash} variant="full" />
              </div>
              <EventDetail event={event} caseId={caseId} />
            </div>
          </li>
        ))}
      </ol>

      {showNext && last && (
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
    </div>
  );
}

/** El resultado de la verificación, en palabras: qué se recalculó y hasta dónde llega el anclaje
 * externo. Sin verificar es un estado gris, nunca un sello verde por defecto. */
export function CustodyVerification({
  verification,
}: {
  verification: CustodyVerificationOut | null;
}) {
  const anchor = verification === null ? null : verification.latest_anchor;
  const anchorCoversHead =
    verification?.intact === true &&
    anchor !== null &&
    anchor.seq === verification.events_checked &&
    anchor.head_hash.toLowerCase() === verification.head_hash.toLowerCase();

  return (
    <div className={styles.verification} role="status" aria-live="polite">
      {verification === null ? (
        <>
          <StatusBadge tone="muted">Sin verificar</StatusBadge>
          <p>La cadena todavía no se ha recalculado en esta visita.</p>
        </>
      ) : verification.intact ? (
        <>
          <StatusBadge tone="ok">Integridad comprobada</StatusBadge>
          {anchor === null ? (
            <p>
              {`Coinciden los ${verification.events_checked} eventos guardados. Esta comprobación no incluye un anclaje externo.`}
            </p>
          ) : anchorCoversHead ? (
            <p>
              {`Coinciden los ${verification.events_checked} eventos guardados. El anclaje externo cubre la cabeza actual, hasta el evento #${anchor.seq}. Sello recibido el ${formatColombiaTime(anchor.tsa_time, { seconds: true })}.`}
            </p>
          ) : anchor.seq < verification.events_checked ? (
            <p>
              {`Coinciden los ${verification.events_checked} eventos guardados. El anclaje externo cubre hasta el evento #${anchor.seq}; los eventos posteriores aún no están anclados. Sello recibido el ${formatColombiaTime(anchor.tsa_time, { seconds: true })}.`}
            </p>
          ) : (
            <p>
              {`Coinciden los ${verification.events_checked} eventos guardados, pero el anclaje registrado para el evento #${anchor.seq} no coincide con la cabeza recalculada. Revise esta inconsistencia antes de usar el historial.`}
            </p>
          )}
        </>
      ) : (
        <>
          <StatusBadge tone="error">Cadena alterada</StatusBadge>
          <p>{`La cadena no cierra en el evento #${verification.broken_at ?? 1}. Revise el historial antes de usarlo.`}</p>
        </>
      )}
    </div>
  );
}
