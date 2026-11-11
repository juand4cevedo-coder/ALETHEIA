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
