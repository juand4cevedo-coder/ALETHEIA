// Problem Details que la API devuelve cuando la persona tiene sesión pero no ha aceptado los
// textos legales vigentes (RN-029). Debe ser el mismo de backend/app/core/legal.py.
export const LEGAL_ACCEPTANCE_REQUIRED =
  "https://aletheia.sbs/problemas/aceptar-textos-legales";

/** Si un error de la API significa que faltan por aceptar los textos legales vigentes. */
export function isLegalAcceptanceRequired(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "type" in error &&
    error.status === 403 &&
    error.type === LEGAL_ACCEPTANCE_REQUIRED
  );
}
