import {
  custodyActionLabel,
  pendingStampPositions,
} from "../../features/cases/custodyActions.ts";
import styles from "./ChainStrip.module.css";

type ChainStripProps = {
  /** Acciones de los últimos eventos de la cadena, la más reciente al final. */
  actions: readonly string[];
};

// Los rombos más antiguos se atenúan: la vista va hacia lo último que ocurrió.
const VIVID = 3;

function describe(actions: readonly string[], pending: Set<number>): string {
  if (actions.length === 0) return "Sin eventos registrados";
  const names = actions.map((action, index) =>
    pending.has(index)
      ? `${custodyActionLabel(action)} (sello de tiempo pendiente)`
      : custodyActionLabel(action),
  );
  const lead =
    actions.length === 1
      ? "Último evento"
      : `Últimos ${actions.length} eventos`;
  return `${lead}: ${names.join(", ")}`;
}

// Miniatura de la cadena de custodia (maqueta 01): un rombo por cada uno de los últimos eventos,
// unidos como eslabones. Un rombo ámbar es una evidencia cuyo sello de tiempo sigue pendiente.
// El lector de pantalla recibe la lista de eventos con sus nombres.
export function ChainStrip({ actions }: ChainStripProps) {
  const pending = pendingStampPositions(actions);
  return (
    <span
      className={styles.strip}
      role="img"
      aria-label={describe(actions, pending)}
    >
      {actions.map((action, index) => (
        <span
          // Las acciones se repiten; su posición en la cadena es su identidad.
          key={index}
          className={styles.link}
          data-action={action}
          data-pending={pending.has(index) || undefined}
          data-faded={index < actions.length - VIVID || undefined}
        />
      ))}
    </span>
  );
}
