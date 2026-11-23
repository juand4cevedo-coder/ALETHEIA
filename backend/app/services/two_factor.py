"""Segundo factor: activar, verificar al ingresar, desactivar y renovar los códigos de respaldo.

Todo código erróneo cuenta para un límite por persona y por IP, y deja un evento en la auditoría
del despacho. Un código TOTP vale una sola vez (ver app.core.two_factor) y cada código de
respaldo también.
"""

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core import two_factor as totp
from app.core.config import Settings
from app.core.tokens import InvalidLinkError, LinkPurpose, read_link, state_matches
from app.models import TwoFactorRecoveryCode, User, UserTwoFactor
from app.services import rate_limit
from app.services.sessions import (
    IssuedSession,
    _audit,
    _enter_organization,
    start_session,
)


class TwoFactorAlreadyEnabledError(Exception):
    """La persona ya tiene el segundo factor activo."""


class TwoFactorNotEnabledError(Exception):
    """La persona no tiene el segundo factor activo."""


class TwoFactorSetupNotStartedError(Exception):
    """No hay una activación en curso: primero se pide el secreto."""


class InvalidTwoFactorCodeError(Exception):
    """El código no coincide, ya se usó o venció."""


class InvalidChallengeError(Exception):
    """El desafío del segundo paso falta, venció o ya no corresponde a la cuenta."""


@dataclass(frozen=True, slots=True)
class Setup:
    secret: str
    uri: str


@dataclass(frozen=True, slots=True)
class Status:
    enabled: bool
    recovery_codes_remaining: int


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


def status(session: Session, user_id: uuid.UUID) -> Status:
    record = session.get(UserTwoFactor, user_id)
    if record is None or record.enabled_at is None:
        return Status(enabled=False, recovery_codes_remaining=0)
    remaining = session.scalar(
        select(func.count())
        .select_from(TwoFactorRecoveryCode)
        .where(TwoFactorRecoveryCode.user_id == user_id, TwoFactorRecoveryCode.used_at.is_(None))
    )
    return Status(enabled=True, recovery_codes_remaining=remaining or 0)


def begin_setup(session: Session, settings: Settings, user: User) -> Setup:
    """Crea (o reemplaza) el secreto de una activación a medias y lo entrega una vez."""
    record = session.get(UserTwoFactor, user.id, with_for_update=True)
    if record is not None and record.enabled_at is not None:
        raise TwoFactorAlreadyEnabledError
    secret = totp.new_secret()
    encrypted = totp.encrypt_secret(settings.signing_key(), secret)
    if record is None:
        session.add(UserTwoFactor(user_id=user.id, secret_encrypted=encrypted))
    else:
        record.secret_encrypted = encrypted
        record.last_step = None
    session.commit()
    return Setup(
        secret=totp.secret_to_base32(secret), uri=totp.provisioning_uri(secret, user.email)
    )


def _new_codes(session: Session, settings: Settings, user_id: uuid.UUID) -> list[str]:
    session.execute(delete(TwoFactorRecoveryCode).where(TwoFactorRecoveryCode.user_id == user_id))
    codes = totp.new_recovery_codes()
    key = settings.signing_key()
    for code in codes:
        session.add(
            TwoFactorRecoveryCode(user_id=user_id, code_hash=totp.recovery_code_hash(key, code))
        )
    return codes


def _fail(
    session: Session,
    user_id: uuid.UUID,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    rate_limit.record(session, rate_limit.TWO_FACTOR_ACCOUNT, str(user_id))
    rate_limit.record(session, rate_limit.TWO_FACTOR_IP, client_ip)
    membership = _enter_organization(session, user_id)
    organization_id = membership.organization_id if membership is not None else None
    _audit(session, "two_factor_failed", organization_id, user_id, client_ip, user_agent, _now())
    session.commit()


def _consume(
    session: Session,
    settings: Settings,
    record: UserTwoFactor,
    code: str,
    *,
    client_ip: str,
    user_agent: str | None,
    require_enabled: bool,
) -> bool:
    """Gasta un código TOTP o de respaldo. Devuelve False, sin cambiar nada, si no sirve."""
    key = settings.signing_key()
    if require_enabled and totp.looks_like_recovery_code(code):
        row = session.scalar(
            select(TwoFactorRecoveryCode)
            .where(
                TwoFactorRecoveryCode.user_id == record.user_id,
                TwoFactorRecoveryCode.code_hash == totp.recovery_code_hash(key, code),
                TwoFactorRecoveryCode.used_at.is_(None),
            )
            .with_for_update()
        )
        if row is None:
            return False
        row.used_at = _now()
        membership = _enter_organization(session, record.user_id)
        _audit(
            session,
            "two_factor_recovery_used",
            membership.organization_id if membership is not None else None,
            record.user_id,
            client_ip,
            user_agent,
            _now(),
        )
        return True
    try:
        secret = totp.decrypt_secret(key, record.secret_encrypted)
    except totp.InvalidSecretError:
        return False
    step = totp.verify_code(secret, code, after_step=record.last_step)
    if step is None:
        return False
    record.last_step = step
    return True


def verify(
    session: Session,
    settings: Settings,
    user_id: uuid.UUID,
    code: str,
    *,
    client_ip: str,
    user_agent: str | None,
    pending: bool = False,
) -> None:
    """Comprueba un código de la persona. Si no sirve, lo cuenta y lanza InvalidTwoFactorCodeError.

    Con pending=True el secreto todavía no está activo (se está confirmando la activación): solo
    se acepta un código de la aplicación, no uno de respaldo. No hace commit si el código sirve.
    """
    rate_limit.check(session, rate_limit.TWO_FACTOR_IP, client_ip)
    rate_limit.check(session, rate_limit.TWO_FACTOR_ACCOUNT, str(user_id))
    record = session.get(UserTwoFactor, user_id, with_for_update=True)
    if record is None:
        raise TwoFactorSetupNotStartedError if pending else TwoFactorNotEnabledError
    if pending == (record.enabled_at is not None):
        raise TwoFactorAlreadyEnabledError if pending else TwoFactorNotEnabledError
    if not _consume(
        session,
        settings,
        record,
        code,
        client_ip=client_ip,
        user_agent=user_agent,
        require_enabled=not pending,
    ):
        _fail(session, user_id, client_ip=client_ip, user_agent=user_agent)
        raise InvalidTwoFactorCodeError
    rate_limit.clear(session, rate_limit.TWO_FACTOR_ACCOUNT, str(user_id))


def enable(
    session: Session,
    settings: Settings,
    user: User,
    code: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> list[str]:
    """Confirma la activación con un primer código y entrega los códigos de respaldo una vez."""
    verify(
        session,
        settings,
        user.id,
        code,
        client_ip=client_ip,
        user_agent=user_agent,
        pending=True,
    )
    record = session.get(UserTwoFactor, user.id)
    if record is None:
        raise TwoFactorSetupNotStartedError
    record.enabled_at = _now()
    codes = _new_codes(session, settings, user.id)
    membership = _enter_organization(session, user.id)
    _audit(
        session,
        "two_factor_enabled",
        membership.organization_id if membership is not None else None,
        user.id,
        client_ip,
        user_agent,
        _now(),
    )
    session.commit()
    return codes


def disable(
    session: Session,
    settings: Settings,
    user: User,
    code: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """Quita el segundo factor: pide un código vigente, para que una sesión robada no baste."""
    verify(session, settings, user.id, code, client_ip=client_ip, user_agent=user_agent)
    session.execute(delete(TwoFactorRecoveryCode).where(TwoFactorRecoveryCode.user_id == user.id))
    session.execute(delete(UserTwoFactor).where(UserTwoFactor.user_id == user.id))
    membership = _enter_organization(session, user.id)
    _audit(
        session,
        "two_factor_disabled",
        membership.organization_id if membership is not None else None,
        user.id,
        client_ip,
        user_agent,
        _now(),
    )
    session.commit()


def regenerate_codes(
    session: Session,
    settings: Settings,
    user: User,
    code: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> list[str]:
    """Reemplaza los códigos de respaldo; los anteriores dejan de valer."""
    verify(session, settings, user.id, code, client_ip=client_ip, user_agent=user_agent)
    codes = _new_codes(session, settings, user.id)
    membership = _enter_organization(session, user.id)
    _audit(
        session,
        "two_factor_codes_regenerated",
        membership.organization_id if membership is not None else None,
        user.id,
        client_ip,
        user_agent,
        _now(),
    )
    session.commit()
    return codes


def complete_sign_in(
    session: Session,
    settings: Settings,
    challenge: str,
    code: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> IssuedSession:
    """Segundo paso del ingreso: con el desafío y un código válido, abre la sesión."""
    try:
        claims = read_link(settings.signing_key(), LinkPurpose.TWO_FACTOR_CHALLENGE, challenge)
    except InvalidLinkError:
        raise InvalidChallengeError from None
    user = session.get(User, claims.subject)
    if (
        user is None
        or user.status != "active"
        or not state_matches(
            settings.signing_key(),
            LinkPurpose.TWO_FACTOR_CHALLENGE,
            claims,
            str(user.security_stamp),
        )
    ):
        raise InvalidChallengeError
    verify(session, settings, user.id, code, client_ip=client_ip, user_agent=user_agent)
    membership = _enter_organization(session, user.id)
    issued = start_session(
        session,
        settings,
        user.id,
        membership.organization_id if membership is not None else None,
        client_ip=client_ip,
        user_agent=user_agent,
        now=_now(),
    )
    session.commit()
    return issued
