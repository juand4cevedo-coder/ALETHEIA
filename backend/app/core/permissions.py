"""Capacidades efectivas de cada rol, limitadas a las funciones disponibles hoy.

La administración de plataforma no concede acceso a datos de un despacho. Una persona
necesita una membresía en ese despacho para consultar sus casos.
"""

from typing import Final, Literal

Permission = Literal[
    "platform.manage",
    "organization.view",
    "organization.manage",
    "team.manage",
    "billing.manage",
    "cases.read_assigned",
    "cases.create",
    "cases.manage_members",
    "cases.manage_lifecycle",
    "cases.manage_retention",
    "cases.manage_tasks",
    "cases.complete_assigned_tasks",
    "cases.write_notes",
    "cases.upload_evidence",
    "cases.download_evidence",
    "cases.manage_client_portal",
]

ROLE_PERMISSIONS: Final[dict[str, frozenset[Permission]]] = {
    "owner": frozenset(
        {
            "organization.view",
            "organization.manage",
            "team.manage",
            "billing.manage",
            "cases.read_assigned",
            "cases.create",
            "cases.manage_members",
            "cases.manage_lifecycle",
            "cases.manage_retention",
            "cases.manage_tasks",
            "cases.complete_assigned_tasks",
            "cases.write_notes",
            "cases.upload_evidence",
            "cases.download_evidence",
            "cases.manage_client_portal",
        }
    ),
    "admin": frozenset(
        {
            "organization.view",
            "team.manage",
            "cases.read_assigned",
            "cases.manage_members",
            "cases.manage_lifecycle",
            "cases.manage_retention",
            "cases.manage_tasks",
            "cases.complete_assigned_tasks",
            "cases.write_notes",
            "cases.upload_evidence",
            "cases.download_evidence",
        }
    ),
    "lawyer": frozenset(
        {
            "organization.view",
            "cases.read_assigned",
            "cases.create",
            "cases.manage_members",
            "cases.manage_lifecycle",
            "cases.manage_tasks",
            "cases.complete_assigned_tasks",
            "cases.write_notes",
            "cases.upload_evidence",
            "cases.download_evidence",
            "cases.manage_client_portal",
        }
    ),
    "assistant": frozenset(
        {
            "organization.view",
            "cases.read_assigned",
            "cases.write_notes",
            "cases.upload_evidence",
            "cases.complete_assigned_tasks",
        }
    ),
}


# En una firma, el responsable dirige el despacho: arma el equipo, paga el plan y fija las
# políticas, pero no abre casos; los abren sus abogados (ADR-062). En una cuenta independiente
# el responsable es el abogado, así que conserva todos sus permisos.
FIRM_OWNER_WITHOUT: Final[frozenset[Permission]] = frozenset({"cases.create"})


def permissions_for(
    role: str | None, *, platform_admin: bool = False, organization_kind: str | None = None
) -> frozenset[Permission]:
    """Da permisos de la membresía actual y, por separado, de la plataforma."""
    if platform_admin:
        return frozenset({"platform.manage"})
    granted = ROLE_PERMISSIONS.get(role, frozenset()) if role else frozenset()
    if role == "owner" and organization_kind == "firm":
        return granted - FIRM_OWNER_WITHOUT
    return granted


def can_create_cases(role: str | None, organization_kind: str | None) -> bool:
    """Si la persona abre casos según su rol y el tipo de su despacho (RN-008, ADR-062)."""
    return "cases.create" in permissions_for(role, organization_kind=organization_kind)


def has_permission(role: str | None, permission: Permission) -> bool:
    """Comprueba una capacidad de despacho sin aceptar privilegios de plataforma."""
    return permission in ROLE_PERMISSIONS.get(role, frozenset()) if role else False
