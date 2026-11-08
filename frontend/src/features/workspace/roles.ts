import type {
  InvitationOut,
  OrganizationMembership,
} from "../../api/generated";

export type Role = OrganizationMembership["role"];
export type InvitableRole = InvitationOut["role"];

// Nombres de los roles tal como los lee la persona (especificación, sección 5).
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Propietario",
  admin: "Administrador",
  lawyer: "Abogado",
  assistant: "Asistente",
};

// Qué puede hacer cada rol que se invita, con las palabras del Manual de Usuario (sección 4).
// El propietario no se invita: nace con la organización (RN-010).
export const INVITABLE_ROLES: readonly {
  value: InvitableRole;
  label: string;
  description: string;
}[] = [
  {
    value: "lawyer",
    label: ROLE_LABELS.lawyer,
    description: "Crea casos y trabaja en los que le asignan.",
  },
  {
    value: "assistant",
    label: ROLE_LABELS.assistant,
    description:
      "Sube evidencias en los casos que le asignan; no descarga ni exporta.",
  },
  {
    value: "admin",
    label: ROLE_LABELS.admin,
    description:
      "Gestiona el equipo, ve todos los casos y consulta la auditoría.",
  },
];

/** Quién gestiona el equipo: invitar, revocar, cambiar roles (RN-008). */
export function managesTeam(role: Role | undefined): boolean {
  return role === "owner" || role === "admin";
}
