"""Eliminar una cuenta desde la plataforma, por ejemplo una cuenta de prueba (ADR-056).

Es el cierre de cuenta pedido por la cuenta propietaria de la plataforma: corta el acceso, libera
el correo para volver a registrarlo y minimiza la identidad. La fila de la persona sobrevive como
seudónimo para no reescribir autorías ni cadenas de custodia, y los casos con conservación vigente
no se tocan: la conservación del producto no depende de quién pida la eliminación. Si la persona
es la única responsable de su despacho, el despacho se cierra con ella; si hay más personas,
primero hay que retirarlas. Todo ocurre dentro de la función `delete_user_as_platform`, que corre
como dueño del esquema y se autoriza sola.
"""

import uuid

from psycopg.errors import InsufficientPrivilege, ObjectNotInPrerequisiteState
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import AuditLog, User
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal

__all__ = [
    "AccountNotFoundError",
    "ConfirmationMismatchError",
    "OwnerHasTeamError",
    "ProtectedAccountError",
    "delete_account",
]


class AccountNotFoundError(Exception):
    """La cuenta no existe o ya está eliminada."""


class ProtectedAccountError(Exception):
    """Una cuenta de plataforma no se elimina desde aquí."""


class ConfirmationMismatchError(Exception):
    """El correo escrito no coincide con el de la cuenta."""


class OwnerHasTeamError(Exception):
    """La persona es responsable de un despacho que todavía tiene más personas."""


def delete_account(
    session: Session,
    principal: Principal,
    user_id: uuid.UUID,
    confirmation: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    user = session.get(User, user_id)
    if user is None or user.status == "closed":
        raise AccountNotFoundError
    if user.is_platform_admin or user.id == principal.user_id:
        raise ProtectedAccountError
    if confirmation.strip().lower() != user.email.lower():
        raise ConfirmationMismatchError
    target_id = user.id
    try:
        organization_id = session.scalar(
            select(func.delete_user_as_platform(target_id, principal.user_id))
        )
    except DBAPIError as exc:
        session.rollback()
        if isinstance(exc.orig, ObjectNotInPrerequisiteState):
            raise OwnerHasTeamError from None
        if isinstance(exc.orig, InsufficientPrivilege):
            raise ProtectedAccountError from None
        raise
    session.add(
        AuditLog(
            organization_id=None,
            actor_user_id=principal.user_id,
            action="account_deleted_by_platform",
            target_id=target_id,
            details={
                "identity": "anonymized",
                "case_records": "preserved",
                "organization_id": str(organization_id) if organization_id else None,
            },
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
        )
    )
    session.commit()
