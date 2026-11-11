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

// Qué puede hacer cada rol que se invita, a partir del Manual de Usuario (sección 4). Solo se
// nombra lo que la plataforma ya hace: la carga de evidencias y la auditoría aún no existen.
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
      "Apoya los casos que le asignan, sin descargar ni exportar evidencias.",
  },
  {
    value: "admin",
    label: ROLE_LABELS.admin,
    description: "Gestiona el equipo y ve todos los casos de la organización.",
  },
];

/** Quién gestiona el equipo: invitar, revocar, cambiar roles (RN-008). */
export function managesTeam(role: Role | undefined): boolean {
  return role === "owner" || role === "admin";
}
