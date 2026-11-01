import { LEGAL_EFFECTIVE_DATE } from "../../config/legal.ts";

const longDate = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeZone: "America/Bogota",
});

/**
 * Fecha de vigencia en palabras, por ejemplo "2 de noviembre de 2026". La fecha se fija a la
 * medianoche de Colombia (UTC-5): leída como UTC, en Colombia caería el día anterior.
 */
export function formatEffectiveDate(): string {
  return longDate.format(new Date(`${LEGAL_EFFECTIVE_DATE}T00:00:00-05:00`));
}
