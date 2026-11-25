// Piezas que comparten las pantallas de la consola de la plataforma: el aviso para cuentas sin
// el cargo, las fechas en hora de Colombia, los nombres de los estados y la paginación por
// cursor. Cada pantalla vive en su propio archivo; aquí solo va lo repetido.
import { Button } from "../../components/ui/Button.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import {
  formatColombiaDate,
  formatColombiaTime,
} from "../../features/cases/dates.ts";
import type { useCursorPager } from "./pager.ts";
import styles from "./Platform.module.css";

export function Restricted() {
  return <Notice tone="error">Esta cuenta no administra la plataforma.</Notice>;
}

/** Fecha y hora de Colombia, legibles y con su valor máquina para lectores y buscadores. */
export function DateText({
  value,
  dateOnly = false,
}: {
  value: string;
  dateOnly?: boolean;
}) {
  return (
    <time dateTime={value}>
      {dateOnly ? formatColombiaDate(value) : formatColombiaTime(value)}
    </time>
  );
}

export function Pager({
  pager,
  next,
}: {
  pager: ReturnType<typeof useCursorPager>;
  next: string | null | undefined;
}) {
  if (!pager.hasPrevious && !next) return null;
  return (
    <div className={styles.pager}>
      {pager.hasPrevious && (
        <Button size="sm" variant="secondary" onClick={pager.back}>
          Anterior
        </Button>
      )}
      {next && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => pager.forward(next)}
        >
          Ver más
        </Button>
      )}
    </div>
  );
}
