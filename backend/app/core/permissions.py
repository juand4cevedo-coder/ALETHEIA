"""Capacidades efectivas de cada rol, limitadas a las funciones disponibles hoy.

La administración de plataforma no concede acceso a datos de un despacho. Una persona
necesita una membresía en ese despacho para consultar sus casos.
"""

from typing import Final, Literal

Permission = Literal[
    "platform.manage",
    "organization.view",
    "team.manage",
    "cases.read_assigned",
    "cases.create",
    "cases.manage_members",
]

ROLE_PERMISSIONS: Final[dict[str, frozenset[Permission]]] = {
    "owner": frozenset(
        {
            "organization.view",
            "team.manage",
            "cases.read_assigned",
            "cases.create",
            "cases.manage_members",
        }
    ),
    "admin": frozenset(
        {
            "organization.view",
            "team.manage",
            "cases.read_assigned",
            "cases.create",
            "cases.manage_members",
        }
    ),
    "lawyer": frozenset(
        {"organization.view", "cases.read_assigned", "cases.create", "cases.manage_members"}
    ),
    "assistant": frozenset({"organization.view", "cases.read_assigned"}),
}


def permissions_for(role: str | None, *, platform_admin: bool = False) -> frozenset[Permission]:
    """Da permisos de la membresía actual y, por separado, de la plataforma."""
    organization_permissions = ROLE_PERMISSIONS.get(role, frozenset()) if role else frozenset()
    if platform_admin:
        return (
            organization_permissions
            - {"cases.read_assigned", "cases.create", "cases.manage_members"}
        ) | {"platform.manage"}
    return organization_permissions


def has_permission(role: str | None, permission: Permission) -> bool:
    """Comprueba una capacidad de despacho sin aceptar privilegios de plataforma."""
    return permission in ROLE_PERMISSIONS.get(role, frozenset()) if role else False
