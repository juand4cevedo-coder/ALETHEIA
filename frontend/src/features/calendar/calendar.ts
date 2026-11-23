// Fechas del calendario de plazos. Todo se calcula en la hora de Colombia (UTC-5, sin horario de
// verano), igual que el resto de la interfaz: un plazo de las 11 de la noche no debe pasar al
// día siguiente porque el navegador esté en otra zona.

const OFFSET = "-05:00";
const ZONE = "America/Bogota";

const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME_FORMAT = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const MONTH_FORMAT = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const LONG_DAY_FORMAT = new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export type MonthRef = { year: number; month: number };

/** AAAA-MM-DD de un instante, en hora de Colombia. */
export function dayKey(iso: string): string {
  return DAY_FORMAT.format(new Date(iso));
}

/** Hora de un instante en Colombia, por ejemplo «3:00 p. m.». */
export function timeLabel(iso: string): string {
  return TIME_FORMAT.format(new Date(iso));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Mes de hoy, en hora de Colombia. */
export function currentMonth(now: Date = new Date()): MonthRef {
  const [year, month] = DAY_FORMAT.format(now).split("-").map(Number);
  return { year: year!, month: month! };
}

export function addMonths({ year, month }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Inicio inclusivo y fin exclusivo del mes, como los pide la API. */
export function monthRange({ year, month }: MonthRef): {
  from: string;
  to: string;
} {
  const next = addMonths({ year, month }, 1);
  return {
    from: `${year}-${pad(month)}-01T00:00:00${OFFSET}`,
    to: `${next.year}-${pad(next.month)}-01T00:00:00${OFFSET}`,
  };
}

/** Periodo que cubre la cuadrícula visible: de su primer lunes al día siguiente a su último
 * domingo. Incluye los días de los meses vecinos que completan las filas, para que elegirlos
 * no muestre como vacío un día que sí tiene plazos. */
export function gridRange(month: MonthRef): { from: string; to: string } {
  const cells = monthGrid(month).flat();
  const last = cells.at(-1)!.key;
  const [year, mon, day] = last.split("-").map(Number);
  const after = new Date(Date.UTC(year!, mon! - 1, day! + 1));
  return {
    from: `${cells[0]!.key}T00:00:00${OFFSET}`,
    to: `${after.getUTCFullYear()}-${pad(after.getUTCMonth() + 1)}-${pad(after.getUTCDate())}T00:00:00${OFFSET}`,
  };
}

export function monthLabel({ year, month }: MonthRef): string {
  const label = MONTH_FORMAT.format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** «martes, 24 de noviembre», para el encabezado del día elegido. */
export function dayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const label = LONG_DAY_FORMAT.format(
    new Date(Date.UTC(year!, month! - 1, day!)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export type Cell = { key: string; day: number; inMonth: boolean };

/** Semanas del mes, de lunes a domingo, con los días de los meses vecinos que completan la
 * primera y la última fila. */
export function monthGrid({ year, month }: MonthRef): Cell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  // getUTCDay: 0 es domingo; la semana empieza en lunes.
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  const cells: Cell[] = [];
  for (let index = 0; index < total; index += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - lead + index));
    cells.push({
      key: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month - 1,
    });
  }
  const weeks: Cell[][] = [];
  for (let start = 0; start < cells.length; start += 7) {
    weeks.push(cells.slice(start, start + 7));
  }
  return weeks;
}
