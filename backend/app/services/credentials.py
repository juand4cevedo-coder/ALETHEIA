"""Recuperar y cambiar la contraseña (RF-012, RF-013, HU-010).

El enlace de recuperación es un token firmado de 1 hora que no se guarda en ninguna tabla.
Lleva el sello del security_stamp y del correo vigentes. El stamp es un valor aleatorio que
cambia con cada cambio de contraseña, así que el enlace deja de valer en cuanto se usa
(CA-HU-010-01), y ningún token depende del hash de la contraseña. Una hora es
suficiente para abrir el correo y corta la vida de un enlace que alguien encuentre después.

Pedir el enlace siempre recibe la misma respuesta, exista o no la cuenta, y cuenta igual para
los dos límites (CA-HU-010-02). Restablecer o cambiar la contraseña cierra las demás sesiones
y avisa por correo, para que la persona sepa si no fue ella.
"""

import datetime
import uuid
from typing import Final

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.passwords import check_password, hash_password, normalize
from app.core.tokens import InvalidLinkError, LinkPurpose, issue_link, read_link, state_matches
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, User
from app.repositories import accounts as accounts_repository
from app.repositories import sessions as sessions_repository
from app.services import jobs, rate_limit
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal

RESET_LINK_LIFETIME: Final = datetime.timedelta(hours=1)
RESET_TEMPLATE: Final = "password_reset"
CHANGED_TEMPLATE: Final = "password_changed"
RESET_PATH: Final = "/restablecer-contrasena"


class WrongCurrentPasswordError(Exception):
    """La contraseña actual no coincide con la de la cuenta."""


class SamePasswordError(Exception):
    """La contraseña nueva es igual a la actual."""


def recovery_state(user: User) -> str:
    """Lo que sella el enlace: el security_stamp vigente y el correo, en minúsculas."""
    return f"{user.security_stamp}|{user.email.lower()}"


def reset_link(settings: Settings, user: User) -> str:
    """Enlace para restablecer la contraseña. El token va en el fragmento (#t=…): el navegador
    nunca lo envía al servidor, así que no queda en los registros ni en la cabecera Referer."""
    token = issue_link(
        settings.signing_key(),
        LinkPurpose.ACCOUNT_RECOVERY,
        user.id,
        recovery_state(user),
        RESET_LINK_LIFETIME,
    )
    return f"{settings.public_url}{RESET_PATH}#t={token}"


def request_reset(session: Session, email: str, *, client_ip: str) -> None:
    """Encola el enlace si hay una cuenta activa con ese correo (API-011).

    Los dos topes cuentan toda petición, exista o no la cuenta, así que ni la respuesta ni el
    429 revelan nada. El enlace se arma al enviar el correo, con la contraseña de ese momento.
    """
    rate_limit.hit(session, rate_limit.PASSWORD_RESET_IP, client_ip)
    rate_limit.hit(session, rate_limit.PASSWORD_RESET_ACCOUNT, email)
    user = accounts_repository.user_by_email(session, email)
    if user is not None and user.status == "active":
        _enqueue(session, RESET_TEMPLATE, user.id)
    session.commit()


def reset_password(
    session: Session,
    settings: Settings,
    token: str,
    password: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """Fija la contraseña nueva con el enlace (API-012) o lanza InvalidLinkError.

    Un enlace alterado, vencido, de otro uso, ya usado o de una cuenta bloqueada dan el mismo
    error. Abrir el enlace demuestra que la persona controla el correo, así que también lo
    deja verificado. Todas las sesiones se cierran: quien tenía la contraseña anterior queda
    fuera.
    """
    rate_limit.hit(session, rate_limit.PASSWORD_RESET_IP, client_ip)
    session.commit()

    key = settings.signing_key()
    claims = read_link(key, LinkPurpose.ACCOUNT_RECOVERY, token)
    # El candado pone en fila dos envíos del mismo enlace: el segundo ve el stamp nuevo y falla.
    user = session.get(User, claims.subject, with_for_update=True)
    if (
        user is None
        or user.status != "active"
        or not state_matches(key, LinkPurpose.ACCOUNT_RECOVERY, claims, recovery_state(user))
    ):
        session.rollback()
        raise InvalidLinkError

    now = datetime.datetime.now(datetime.UTC)
    user.password_hash = hash_password(password)
    user.security_stamp = uuid.uuid4()
    if user.email_verified_at is None:
        user.email_verified_at = now
    sessions_repository.revoke_user_sessions(session, user.id, now)
    # Quien recupera la contraseña vuelve a tener sus cinco intentos de ingreso.
    rate_limit.clear(session, rate_limit.LOGIN_ACCOUNT, user.email)
    _audit(session, user.id, "password_reset", client_ip, user_agent, now)
    _enqueue(session, CHANGED_TEMPLATE, user.id)
    session.commit()


def change_password(
    session: Session,
    principal: Principal,
    current_password: str,
    new_password: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """Cambia la contraseña de quien tiene la sesión (API-013).

    Exige la contraseña actual, con el mismo límite de intentos fallidos del ingreso: una
    sesión robada no sirve para adivinarla. Cierra las demás sesiones y conserva la actual.
    """
    user = session.get(User, principal.user_id, with_for_update=True)
    if user is None:  # get_principal acaba de comprobar que existe y está activa.
        msg = "La persona de la sesión no existe"
        raise LookupError(msg)
    rate_limit.check(session, rate_limit.LOGIN_ACCOUNT, user.email)
    if not check_password(user.password_hash, current_password):
        rate_limit.record(session, rate_limit.LOGIN_ACCOUNT, user.email)
        session.commit()
        raise WrongCurrentPasswordError
    if normalize(new_password) == normalize(current_password):
        session.rollback()
        raise SamePasswordError

    now = datetime.datetime.now(datetime.UTC)
    user.password_hash = hash_password(new_password)
    user.security_stamp = uuid.uuid4()
    sessions_repository.revoke_user_sessions(
        session, user.id, now, keep_family=principal.session_id
    )
    rate_limit.clear(session, rate_limit.LOGIN_ACCOUNT, user.email)
    _audit(session, user.id, "password_changed", client_ip, user_agent, now)
    _enqueue(session, CHANGED_TEMPLATE, user.id)
    session.commit()


def _enqueue(session: Session, template: str, user_id: uuid.UUID) -> None:
    # Cada envío es una tarea propia: dos solicitudes legítimas no se funden en una.
    jobs.enqueue(
        session,
        "email_send",
        {"template": template, "user_id": str(user_id)},
        f"{template}:{user_id}:{uuid.uuid7()}",
    )


def _audit(
    session: Session,
    user_id: uuid.UUID,
    action: str,
    client_ip: str,
    user_agent: str | None,
    now: datetime.datetime,
) -> None:
    # La auditoría vive en la organización de la persona: primero se busca con su propio
    # contexto, como al ingresar, y después se fija el de la organización.
    set_tenant(session, TenantContext(user_id=user_id))
    membership = accounts_repository.membership_of(session, user_id)
    if membership is None:
        return
    set_tenant(session, TenantContext(organization_id=membership.organization_id, user_id=user_id))
    session.add(
        AuditLog(
            organization_id=membership.organization_id,
            actor_user_id=user_id,
            action=action,
            target_id=user_id,
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
            created_at=now,
        )
    )
    session.flush()
