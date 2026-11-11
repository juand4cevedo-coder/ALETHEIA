const TIME_ZONE = "America/Bogota";

/** Fecha y hora de Colombia. Con `seconds` agrega los segundos y el sufijo "(UTC−5)", para la
 * hora exacta de un evento de la cadena de custodia. */
export function formatColombiaTime(
  iso: string,
  opts: { seconds?: boolean } = {},
): string {
  const formatted = new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: opts.seconds ? "2-digit" : undefined,
    hourCycle: "h23",
  }).format(new Date(iso));
  return opts.seconds ? `${formatted} (UTC−5)` : formatted;
}

function colombiaDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

/** Cuándo fue la última actividad de un caso, para leerla de un vistazo: «hace un momento»,
 * «hace 7 min», «hoy, 09:12» o la fecha, con el año solo si no es el actual, siempre en hora de Colombia. */
export function formatRecentActivity(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  if (colombiaDay(then) === colombiaDay(now)) {
    const time = new Intl.DateTimeFormat("es-CO", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(then);
    return `hoy, ${time}`;
  }
  // El año solo se escribe si no es el actual.
  const sameYear =
    colombiaDay(then).slice(0, 4) === colombiaDay(now).slice(0, 4);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).format(then);
}
