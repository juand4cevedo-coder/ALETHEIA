// Textos que la API responde en la sección de miembros (API-016 a API-018). Se comparan tal
// cual para mostrar cada uno junto al campo o en el aviso que corresponde.
export const ALREADY_MEMBER = "Esta persona ya es miembro de su organización.";
export const INVITATION_OPEN_PREFIX =
  "Ya hay una invitación vigente para este correo.";

/** Si el 409 es por el cupo del plan (RN-012): la API lo explica con el número de usuarios. */
export function isSeatLimit(detail: string | undefined): boolean {
  return detail?.startsWith("Su plan incluye") ?? false;
}

/** Si el 409 se refiere al correo escrito: ya es miembro o ya tiene una invitación vigente. */
export function isEmailConflict(detail: string | undefined): boolean {
  return (
    detail === ALREADY_MEMBER ||
    (detail?.startsWith(INVITATION_OPEN_PREFIX) ?? false)
  );
}
