import type { Role } from "../workspace/roles.ts";

// Quién abre casos: el propietario, el administrador y el abogado (RN-008). El asistente
// trabaja en los casos que le asignan, pero no los abre; la API también lo exige.
export const CASE_CREATORS: readonly Role[] = ["owner", "admin", "lawyer"];

export function canOpenCases(role?: Role): boolean {
  return role !== undefined && CASE_CREATORS.includes(role);
}
