"""Recuperar el segundo factor de quien perdió el teléfono y los códigos de respaldo (ADR-053).

Sin esto, esa persona dependía de soporte. El camino es el mismo que protege a las demás
credenciales, con una espera de seguridad en medio:

1. Pide la recuperación con su correo. Siempre recibe la misma respuesta, exista o no la cuenta.
2. Abre el enlace del correo (firmado, 1 hora) y confirma con su contraseña. Desde ahí corren
   24 horas. Ella y los dueños de su despacho reciben un aviso con un enlace para cancelar, y el
   hecho queda en la auditoría del despacho.
3. Pasada la espera, vuelve con su correo y su contraseña y termina: el segundo factor queda
   desactivado y todas sus sesiones se cierran. Si su despacho lo exige, el siguiente ingreso
   solo le deja activarlo de nuevo.

Quien tenga la contraseña y el correo puede pedirla, por eso existen la espera y el aviso a otras
personas. Si la persona encuentra su teléfono e ingresa con un código mientras tanto, el pedido
se cancela solo.
"""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.passwords import check_password
from app.core.tokens import InvalidLinkError, LinkPurpose, issue_link, read_link, state_matches
from app.models import (
    AuditLog,
    Membership,
    TwoFactorRecovery,
    TwoFactorRecoveryCode,
    User,
    UserTwoFactor,
)
from app.repositories import accounts as accounts_repository
from app.repositories import sessions as sessions_repository
from app.services import jobs, rate_limit
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import InvalidCredentialsError, _enter_organization

WAIT: Final = datetime.timedelta(hours=24)
# Tras la espera, la persona tiene una semana para terminar; después hay que pedirla de nuevo.
OPEN_AFTER_WAIT: Final = datetime.timedelta(days=7)
CONFIRM_LINK_LIFETIME: Final = datetime.timedelta(hours=1)
CANCEL_LINK_LIFETIME: Final = WAIT + OPEN_AFTER_WAIT
PATH: Final = "/recuperar-segundo-factor"

REQUEST_TEMPLATE: Final = "two_factor_recovery_request"
STARTED_TEMPLATE: Final = "two_factor_recovery_started"
OWNER_NOTICE_TEMPLATE: Final = "two_factor_recovery_owner_notice"
CANCELED_TEMPLATE: Final = "two_factor_recovery_canceled"
COMPLETED_TEMPLATE: Final = "two_factor_recovery_completed"


class NoRecoveryError(Exception):
    """La contraseña es correcta, pero la persona no tiene una recuperación abierta."""


class RecoveryNotReadyError(Exception):
    """La espera de seguridad todavía no termina."""

    def __init__(self, available_at: datetime.datetime) -> None:
        super().__init__("La espera de seguridad no ha terminado.")
        self.available_at = available_at


@dataclass(frozen=True, slots=True)
class Started:
    available_at: datetime.datetime


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


def _enabled_at(session: Session, user_id: uuid.UUID) -> datetime.datetime | None:
    return session.scalar(select(UserTwoFactor.enabled_at).where(UserTwoFactor.user_id == user_id))


def _confirm_state(user: User, enabled_at: datetime.datetime) -> str:
    # El enlace deja de valer si cambia la contraseña, el correo o el segundo factor.
    return f"{user.security_stamp}|{user.email.lower()}|{enabled_at.isoformat()}"


def confirm_link(settings: Settings, user: User, enabled_at: datetime.datetime) -> str:
    """Enlace para confirmar el pedido. El token va en el fragmento (#t=…): el navegador nunca
    lo envía al servidor."""
    token = issue_link(
        settings.signing_key(),
        LinkPurpose.TWO_FACTOR_RECOVERY,
        user.id,
        _confirm_state(user, enabled_at),
        CONFIRM_LINK_LIFETIME,
    )
    return f"{settings.public_url}{PATH}#t={token}"


def _cancel_state(recovery: TwoFactorRecovery) -> str:
    return f"{recovery.id}|{recovery.available_at.isoformat()}"


def cancel_link(settings: Settings, recovery: TwoFactorRecovery) -> str:
    """Enlace para cancelar la recuperación: sirve a la persona y a los dueños del despacho
    mientras el pedido siga abierto."""
    token = issue_link(
        settings.signing_key(),
        LinkPurpose.TWO_FACTOR_RECOVERY_CANCEL,
        recovery.id,
        _cancel_state(recovery),
        CANCEL_LINK_LIFETIME,
    )
    return f"{settings.public_url}{PATH}#c={token}"


def _enqueue(session: Session, template: str, user_id: uuid.UUID, **extra: str) -> None:
    jobs.enqueue(
        session,
        "email_send",
        {"template": template, "user_id": str(user_id), **extra},
        f"{template}:{user_id}:{uuid.uuid7()}",
    )


def _audit(
    session: Session,
    action: str,
    organization_id: uuid.UUID | None,
    actor_id: uuid.UUID | None,
    target_id: uuid.UUID,
    client_ip: str,
    user_agent: str | None,
    now: datetime.datetime,
) -> None:
    session.add(
        AuditLog(
            organization_id=organization_id,
            actor_user_id=actor_id,
            action=action,
            target_id=target_id,
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
            created_at=now,
        )
    )
    session.flush()


def _open_recovery(
    session: Session, user_id: uuid.UUID, *, lock: bool = False
) -> TwoFactorRecovery | None:
    query = select(TwoFactorRecovery).where(
        TwoFactorRecovery.user_id == user_id,
        TwoFactorRecovery.canceled_at.is_(None),
        TwoFactorRecovery.completed_at.is_(None),
    )
    return session.scalar(query.with_for_update() if lock else query)


def request(session: Session, email: str, *, client_ip: str) -> None:
    """Encola el correo con el enlace si hay una cuenta activa con segundo factor.

    Cuenta para los dos topes toda petición, exista o no la cuenta, y siempre se responde igual.
    """
    rate_limit.hit(session, rate_limit.TWO_FACTOR_RECOVERY_IP, client_ip)
    rate_limit.hit(session, rate_limit.TWO_FACTOR_RECOVERY_ACCOUNT, email)
    user = accounts_repository.user_by_email(session, email)
    if user is not None and user.status == "active" and _enabled_at(session, user.id) is not None:
        _enqueue(session, REQUEST_TEMPLATE, user.id)
    session.commit()


def _verified_user(session: Session, email: str, password: str, *, client_ip: str) -> User:
    """La dueña de la cuenta, con la contraseña comprobada y los mismos topes del ingreso."""
    rate_limit.check(session, rate_limit.LOGIN_IP, client_ip)
    rate_limit.check(session, rate_limit.LOGIN_ACCOUNT, email)
    user = accounts_repository.user_by_email(session, email)
    matches = check_password(user.password_hash if user is not None else None, password)
    if user is None or not matches or user.status != "active":
        rate_limit.record(session, rate_limit.LOGIN_IP, client_ip)
        rate_limit.record(session, rate_limit.LOGIN_ACCOUNT, email)
        session.commit()
        raise InvalidCredentialsError
    return user


def confirm(
    session: Session,
    settings: Settings,
    token: str,
    password: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> Started:
    """Abre la espera de seguridad con el enlace del correo y la contraseña (API-052)."""
    rate_limit.hit(session, rate_limit.TWO_FACTOR_RECOVERY_IP, client_ip)
    session.commit()

    key = settings.signing_key()
    claims = read_link(key, LinkPurpose.TWO_FACTOR_RECOVERY, token)
    user = session.get(User, claims.subject, with_for_update=True)
    enabled_at = _enabled_at(session, claims.subject)
    if (
        user is None
        or user.status != "active"
        or enabled_at is None
        or not state_matches(
            key, LinkPurpose.TWO_FACTOR_RECOVERY, claims, _confirm_state(user, enabled_at)
        )
    ):
        session.rollback()
        raise InvalidLinkError

    rate_limit.check(session, rate_limit.LOGIN_ACCOUNT, user.email)
    if not check_password(user.password_hash, password):
        rate_limit.record(session, rate_limit.LOGIN_ACCOUNT, user.email)
        session.commit()
        raise InvalidCredentialsError

    now = _now()
    existing = _open_recovery(session, user.id, lock=True)
    if existing is not None and existing.expires_at > now:
        # Pedir otra vez no reinicia la espera ni vuelve a avisar a nadie.
        session.commit()
        return Started(existing.available_at)
    if existing is not None:
        existing.canceled_at = now
        session.flush()

    recovery = TwoFactorRecovery(
        user_id=user.id, available_at=now + WAIT, expires_at=now + WAIT + OPEN_AFTER_WAIT
    )
    session.add(recovery)
    session.flush()

    membership = _enter_organization(session, user.id)
    organization_id = membership.organization_id if membership is not None else None
    _audit(
        session,
        "two_factor_recovery_requested",
        organization_id,
        user.id,
        user.id,
        client_ip,
        user_agent,
        now,
    )
    recovery_id = str(recovery.id)
    _enqueue(session, STARTED_TEMPLATE, user.id, recovery_id=recovery_id)
    if organization_id is not None:
        owners = session.scalars(
            select(Membership.user_id).where(
                Membership.organization_id == organization_id,
                Membership.role == "owner",
                Membership.user_id != user.id,
            )
        ).all()
        for owner_id in owners:
            _enqueue(session, OWNER_NOTICE_TEMPLATE, owner_id, recovery_id=recovery_id)
    session.commit()
    return Started(recovery.available_at)


def cancel(
    session: Session,
    settings: Settings,
    token: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """Cancela la recuperación con el enlace del aviso (API-053): sirve sin iniciar sesión."""
    rate_limit.hit(session, rate_limit.TWO_FACTOR_RECOVERY_IP, client_ip)
    session.commit()

    key = settings.signing_key()
    claims = read_link(key, LinkPurpose.TWO_FACTOR_RECOVERY_CANCEL, token)
    recovery = session.get(TwoFactorRecovery, claims.subject, with_for_update=True)
    if (
        recovery is None
        or recovery.canceled_at is not None
        or recovery.completed_at is not None
        or not state_matches(
            key, LinkPurpose.TWO_FACTOR_RECOVERY_CANCEL, claims, _cancel_state(recovery)
        )
    ):
        session.rollback()
        raise InvalidLinkError

    now = _now()
    recovery.canceled_at = now
    membership = _enter_organization(session, recovery.user_id)
    # Quien cancela abrió un enlace, no una sesión: el evento queda sin autor.
    _audit(
        session,
        "two_factor_recovery_canceled",
        membership.organization_id if membership is not None else None,
        None,
        recovery.user_id,
        client_ip,
        user_agent,
        now,
    )
    _enqueue(session, CANCELED_TEMPLATE, recovery.user_id)
    session.commit()


def cancel_open_for(session: Session, user_id: uuid.UUID) -> None:
    """La persona ingresó con su segundo factor: la recuperación pendiente ya no hace falta."""
    recovery = _open_recovery(session, user_id, lock=True)
    if recovery is not None:
        recovery.canceled_at = _now()
        session.flush()


def complete(
    session: Session,
    email: str,
    password: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """Termina la recuperación pasada la espera (API-054): desactiva el segundo factor y cierra
    todas las sesiones."""
    user = _verified_user(session, email, password, client_ip=client_ip)
    now = _now()
    recovery = _open_recovery(session, user.id, lock=True)
    if recovery is None or recovery.expires_at <= now:
        session.rollback()
        raise NoRecoveryError
    if recovery.available_at > now:
        available_at = recovery.available_at
        session.rollback()
        raise RecoveryNotReadyError(available_at)

    session.execute(delete(TwoFactorRecoveryCode).where(TwoFactorRecoveryCode.user_id == user.id))
    session.execute(delete(UserTwoFactor).where(UserTwoFactor.user_id == user.id))
    recovery.completed_at = now
    # Cambiar el sello invalida los enlaces pendientes y el desafío de segundo paso en curso.
    user.security_stamp = uuid.uuid4()
    sessions_repository.revoke_user_sessions(session, user.id, now)
    rate_limit.clear(session, rate_limit.LOGIN_ACCOUNT, user.email)
    membership = _enter_organization(session, user.id)
    _audit(
        session,
        "two_factor_recovery_completed",
        membership.organization_id if membership is not None else None,
        user.id,
        user.id,
        client_ip,
        user_agent,
        now,
    )
    _enqueue(session, COMPLETED_TEMPLATE, user.id)
    session.commit()
