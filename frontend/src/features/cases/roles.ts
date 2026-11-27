import type { Role } from "../workspace/roles.ts";

// Quién abre casos: los abogados y, en una cuenta independiente, su responsable, que es el
// abogado (RN-008, ADR-056 y ADR-062). En una firma, el responsable dirige el despacho y no abre
// casos. El administrador lleva la parte administrativa y el asistente trabaja en los casos que
// le asignan: ninguno los abre. La API también lo exige.
type Membership = { role: Role; kind: "individual" | "firm" };

export function canOpenCases(organization?: Membership | null): boolean {
  if (!organization) return false;
  if (organization.role === "lawyer") return true;
  return organization.role === "owner" && organization.kind === "individual";
}
