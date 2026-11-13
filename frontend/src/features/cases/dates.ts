const TIME_ZONE = "America/Bogota";

// Fechas y horas como se escriben en Colombia: «10 de noviembre de 2026», «10:32 a. m.».

/** Fecha y hora de Colombia. Con `seconds` agrega los segundos y aclara «hora de Colombia», para
 * la hora exacta de un evento de la cadena de custodia. */
export function formatColombiaTime(
  iso: string,
  opts: { seconds?: boolean } = {},
): string {
  const formatted = new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: opts.seconds ? "2-digit" : undefined,
    hour12: true,
  }).format(new Date(iso));
  return opts.seconds ? `${formatted} (hora de Colombia)` : formatted;
}

function colombiaDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

/** Cuándo fue la última actividad de un caso, para leerla de un vistazo: «hace un momento»,
 * «hace 7 min», «hoy a las 9:12 a. m.» o la fecha, con el año solo si no es el actual, siempre en
 * hora de Colombia. */
export function formatRecentActivity(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  if (colombiaDay(then) === colombiaDay(now)) {
    const time = new Intl.DateTimeFormat("es-CO", {
      timeZone: TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(then);
    return `hoy a las ${time}`;
  }
  // El año solo se escribe si no es el actual.
  const sameYear =
    colombiaDay(then).slice(0, 4) === colombiaDay(now).slice(0, 4);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: sameYear ? undefined : "numeric",
  }).format(then);
}
