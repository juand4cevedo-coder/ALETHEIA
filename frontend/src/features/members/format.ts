// Fechas de la sección de miembros, siempre en la hora de Colombia: la oficina y quien
// administra la ven igual estén donde estén.
const DATE = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});
const DATE_TIME = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** «7 de noviembre de 2026». */
export function shortDate(iso: string): string {
  return DATE.format(new Date(iso));
}

/** «10 de noviembre de 2026, 3:05 p. m.». */
export function dateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}
