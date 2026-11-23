import type { Role } from "../workspace/roles.ts";

// Quién abre casos: el responsable del despacho y los abogados (RN-008, ADR-056). El
// administrador lleva la parte administrativa del despacho y el asistente trabaja en los casos que
// le asignan: ninguno los abre. La API también lo exige.
const CASE_CREATORS: readonly Role[] = ["owner", "lawyer"];

export function canOpenCases(role?: Role): boolean {
  return role !== undefined && CASE_CREATORS.includes(role);
}
