import type {
  InvitationOut,
  OrganizationMembership,
} from "../../api/generated";

export type Role = OrganizationMembership["role"];
export type InvitableRole = InvitationOut["role"];

// Nombres de los roles tal como los lee la persona (especificación, sección 5).
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Responsable del despacho",
  admin: "Administrador",
  lawyer: "Abogado",
  assistant: "Asistente",
};

// Qué puede hacer cada rol que se invita, a partir del Manual de Usuario (sección 4). Solo se
// nombra lo que la plataforma ya hace.
// El propietario no se invita: nace con la organización (RN-010).
export const INVITABLE_ROLES: readonly {
  value: InvitableRole;
  label: string;
  description: string;
}[] = [
  {
    value: "lawyer",
    label: ROLE_LABELS.lawyer,
    description: "Abre casos y trabaja en los que le asignen.",
  },
  {
    value: "assistant",
    label: ROLE_LABELS.assistant,
    description: "Trabaja en los casos que le asignen.",
  },
  {
    value: "admin",
    label: ROLE_LABELS.admin,
    description: "Gestiona el equipo y trabaja en los casos que le asignen.",
  },
];

/** Quién gestiona el equipo: invitar, revocar, cambiar roles (RN-008). */
// Quien crea y asigna tareas también gestiona las plantillas de tareas.
export function managesTasks(role: Role | undefined): boolean {
  return role === "owner" || role === "admin" || role === "lawyer";
}

export function managesTeam(role: Role | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Quién administra los datos propios del despacho, como su nombre (RN-010). */
export function managesOrganization(role: Role | undefined): boolean {
  return role === "owner";
}
