const DAY_MS = 24 * 60 * 60 * 1000;

/** Desde cuántos días antes del final la cuenta regresiva de la prueba se vuelve un aviso. */
export const TRIAL_URGENT_DAYS = 3;

const bogotaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Medianoche UTC del día que marca el calendario de Colombia en ese instante. */
function colombiaDay(instant: Date): number {
  return Date.parse(`${bogotaDay.format(instant)}T00:00:00Z`);
}

/** Días de calendario de Colombia entre hoy y el día en que termina la prueba: 0 si termina
 * hoy, 1 si termina mañana. Nunca da menos de cero. */
export function trialDaysLeft(endsAt: string, now: Date): number {
  const days = Math.round(
    (colombiaDay(new Date(endsAt)) - colombiaDay(now)) / DAY_MS,
  );
  return Math.max(0, days);
}
