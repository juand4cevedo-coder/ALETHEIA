"""Verificación del correo (HU-006, RF-007): el enlace firmado y las tareas que envían los
correos de la cuenta.

El enlace vale 24 horas y una sola vez: lleva el sello del correo todavía sin verificar, así que
deja de valer en cuanto el correo se verifica o cambia (app.core.tokens).
"""

import datetime
import uuid
from typing import Final

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.tokens import InvalidLinkError, LinkPurpose, issue_link, read_link, state_matches
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Membership, User
from app.services import jobs, rate_limit
from app.services.audit import audit_ip, audit_user_agent

LINK_LIFETIME: Final = datetime.timedelta(hours=24)
VERIFICATION_TEMPLATE: Final = "email_verification"
ACCOUNT_EXISTS_TEMPLATE: Final = "account_exists"
VERIFY_PATH: Final = "/verificar-correo"


def verification_state(email: str) -> str:
    """El estado que sella el enlace: el correo, sin distinguir mayúsculas."""
    return email.lower()


def verification_link(settings: Settings, user_id: uuid.UUID, email: str) -> str:
    """Enlace de verificación. El token va en el fragmento (#t=…): el navegador nunca lo envía
    al servidor, así que no queda en los registros de Caddy ni en la cabecera Referer."""
    token = issue_link(
        settings.signing_key(),
        LinkPurpose.EMAIL_VERIFICATION,
        user_id,
        verification_state(email),
        LINK_LIFETIME,
    )
    return f"{settings.public_url}{VERIFY_PATH}#t={token}"


def _enqueue(session: Session, template: str, user_id: uuid.UUID) -> None:
    # Cada envío es una tarea propia: dos solicitudes legítimas no se funden en una.
    jobs.enqueue(
        session,
        "email_send",
        {"template": template, "user_id": str(user_id)},
        f"{template}:{user_id}:{uuid.uuid7()}",
    )


def enqueue_verification(session: Session, user_id: uuid.UUID) -> None:
    """Encola el correo de verificación en la transacción de session."""
    _enqueue(session, VERIFICATION_TEMPLATE, user_id)


def enqueue_account_exists(session: Session, user_id: uuid.UUID) -> None:
    """Encola el aviso de que alguien intentó registrarse con un correo que ya tiene cuenta."""
    _enqueue(session, ACCOUNT_EXISTS_TEMPLATE, user_id)


def verify_email(
    session: Session,
    settings: Settings,
    token: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """Marca el correo como verificado (API-004) o lanza InvalidLinkError.

    Un enlace alterado, vencido, de otro uso, ya usado o de un correo que cambió dan el mismo
    error. La fila de la persona se bloquea mientras tanto: dos clics simultáneos en el mismo
    enlace no registran dos verificaciones.
    """
    rate_limit.hit(session, rate_limit.EMAIL_VERIFICATION_IP, client_ip)
    session.commit()

    key = settings.signing_key()
    claims = read_link(key, LinkPurpose.EMAIL_VERIFICATION, token)
    user = session.get(User, claims.subject, with_for_update=True)
    if (
        user is None
        or user.email_verified_at is not None
        or not state_matches(
            key, LinkPurpose.EMAIL_VERIFICATION, claims, verification_state(user.email)
        )
    ):
        session.rollback()
        raise InvalidLinkError

    now = datetime.datetime.now(datetime.UTC)
    user.email_verified_at = now
    # La auditoría vive en la organización de la persona: primero se busca con su propio
    # contexto, como al ingresar, y después se fija el de la organización.
    set_tenant(session, TenantContext(user_id=user.id))
    organization_id = session.scalar(
        select(Membership.organization_id).where(Membership.user_id == user.id)
    )
    if organization_id is not None:
        set_tenant(session, TenantContext(organization_id=organization_id, user_id=user.id))
        session.add(
            AuditLog(
                organization_id=organization_id,
                actor_user_id=user.id,
                action="email_verified",
                target_id=user.id,
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
                created_at=now,
            )
        )
    session.commit()
