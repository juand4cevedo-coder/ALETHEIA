"""Eliminar un despacho completo desde la plataforma (ADR-061).

Es la operación de la cuenta propietaria de la plataforma para cerrar un despacho, por ejemplo
uno de prueba o uno que dejó de usar el servicio: se cierran y anonimizan las cuentas de todas
sus personas, se cancela la suscripción, se revocan las invitaciones y los accesos del portal del
cliente, y el despacho queda cerrado. Los casos y sus pruebas se conservan en solo lectura hasta
cumplir su plazo: la conservación no depende de quién pida el cierre. Todo ocurre dentro de la
función `delete_organization_as_platform`, que corre como dueño del esquema y se autoriza sola.
"""

import uuid

from psycopg.errors import InsufficientPrivilege, NoDataFound
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import AuditLog, Organization
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal

__all__ = [
    "ConfirmationMismatchError",
    "OrganizationNotFoundError",
    "ProtectedOrganizationError",
    "delete_organization",
]


class OrganizationNotFoundError(Exception):
    """El despacho no existe o ya está cerrado."""


class ProtectedOrganizationError(Exception):
    """El despacho incluye una cuenta de plataforma, que no se cierra desde aquí."""


class ConfirmationMismatchError(Exception):
    """El nombre escrito no coincide con el del despacho."""


def delete_organization(
    session: Session,
    principal: Principal,
    organization_id: uuid.UUID,
    confirmation: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> int:
    """Cierra el despacho y devuelve cuántas cuentas cerró."""
    organization = session.get(Organization, organization_id)
    if organization is None or organization.status == "closed":
        raise OrganizationNotFoundError
    if confirmation.strip().casefold() != organization.name.strip().casefold():
        raise ConfirmationMismatchError
    try:
        people = session.scalar(
            select(func.delete_organization_as_platform(organization_id, principal.user_id))
        )
    except DBAPIError as exc:
        session.rollback()
        if isinstance(exc.orig, NoDataFound):
            raise OrganizationNotFoundError from None
        if isinstance(exc.orig, InsufficientPrivilege):
            raise ProtectedOrganizationError from None
        raise
    session.add(
        AuditLog(
            organization_id=None,
            actor_user_id=principal.user_id,
            action="organization_deleted_by_platform",
            target_id=organization_id,
            details={
                "accounts_closed": int(people or 0),
                "case_records": "preserved",
            },
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
        )
    )
    session.commit()
    return int(people or 0)
