import type { OrganizationMembership } from "../../api/generated";

// Nombres de los roles tal como los lee la persona (especificación, sección 5).
export const ROLE_LABELS: Record<OrganizationMembership["role"], string> = {
  owner: "Propietario",
  admin: "Administrador",
  lawyer: "Abogado",
  assistant: "Asistente",
};
