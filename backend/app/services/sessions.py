"""Sesiones: ingreso con correo y contraseña (RF-008, HU-007) y la comprobación de cada
petición autenticada (RN-023, ADR-007 y ADR-028).

Al ingresar nacen dos credenciales, cada una en su cookie:

- el token de acceso, un JWT de 10 minutos firmado con la subclave de sesión, que lleva la
  familia de la sesión (app.core.tokens);
- el token de renovación, 32 bytes aleatorios de los que la base solo guarda el SHA-256.

Todas las renovaciones de un mismo ingreso comparten familia y vencimiento: la sesión dura
como máximo 14 días, lo mismo que dice la política de cookies. La rotación y la detección de
reutilización llegan con HU-009 sobre esta misma familia.

Para no revelar qué correos existen (RN-026), un correo sin cuenta, una cuenta sin contraseña
y una contraseña equivocada reciben el mismo error, pasan por el mismo hash Argon2id y cuentan
igual para el límite de intentos.
"""

import datetime
import hashlib
import secrets
import uuid
from dataclasses import dataclass
from typing import Final

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.legal import LEGAL_VERSION
from app.core.passwords import check_password, hash_password, needs_rehash
from app.core.tokens import InvalidAccessTokenError, issue_access_token, read_access_token
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Membership, RefreshToken, User
from app.repositories import accounts as accounts_repository
from app.repositories import sessions as sessions_repository
from app.services import rate_limit
from app.services.audit import audit_ip, audit_user_agent

ACCESS_TOKEN_LIFETIME: Final = datetime.timedelta(minutes=10)
SESSION_LIFETIME: Final = datetime.timedelta(days=14)
# 32 bytes aleatorios: imposible de adivinar, y su SHA-256 cabe exacto en token_hash.
_REFRESH_TOKEN_BYTES: Final = 32


class InvalidCredentialsError(Exception):
    """Correo o contraseña incorrectos. No dice cuál de los dos, ni si la cuenta existe."""


class AccountBlockedError(Exception):
    """La contraseña es correcta, pero la cuenta está bloqueada por la plataforma."""


class NotAuthenticatedError(Exception):
    """No hay una sesión válida: sin token, token alterado o vencido, o sesión cerrada."""


@dataclass(frozen=True, slots=True)
class IssuedSession:
    """Las dos credenciales de un ingreso y hasta cuándo puede durar la sesión."""

    access_token: str
    refresh_token: str
    expires_at: datetime.datetime


@dataclass(frozen=True, slots=True)
class Principal:
    """Quién hace la petición, desde qué sesión y con qué rol en su organización.

    La organización y el rol faltan si la persona ya no pertenece a ninguna, por ejemplo
    después de que la retiren (HU-013).
    """

    user_id: uuid.UUID
    session_id: uuid.UUID
    organization_id: uuid.UUID | None
    role: str | None
    # Fecha de los textos legales que la persona aceptó por última vez (RN-029).
    legal_version: str

    @property
    def accepted_current_legal(self) -> bool:
        """Si ya aceptó los textos legales vigentes."""
        return self.legal_version == LEGAL_VERSION


def refresh_token_hash(token: str) -> bytes:
    """El SHA-256 con que se guarda y se busca un token de renovación."""
    return hashlib.sha256(token.encode()).digest()


def sign_in(
    session: Session,
    settings: Settings,
    email: str,
    password: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> IssuedSession:
    """Abre una sesión si el correo y la contraseña coinciden (API-005).

    Lanza RateLimitExceededError si la cuenta o la IP agotaron sus intentos,
    InvalidCredentialsError si los datos no coinciden y AccountBlockedError si la cuenta está
    bloqueada. Solo los intentos fallidos cuentan para el límite.
    """
    # Sin clave no hay sesión posible: falla antes de tocar la base.
    key = settings.signing_key()
    # Los candados de los dos límites duran hasta el commit: dos intentos simultáneos contra
    # la misma cuenta se atienden de uno en uno y no se cuelan por el último intento libre.
    rate_limit.check(session, rate_limit.LOGIN_IP, client_ip)
    rate_limit.check(session, rate_limit.LOGIN_ACCOUNT, email)

    user = accounts_repository.user_by_email(session, email)
    password_hash = user.password_hash if user is not None else None
    # Siempre se calcula el hash, también sin cuenta: así el tiempo de respuesta es el mismo.
    password_matches = check_password(password_hash, password)
    if user is None or not password_matches:
        _record_failure(session, user, email, client_ip=client_ip, user_agent=user_agent)
        raise InvalidCredentialsError
    if user.status != "active":
        # Quien llega aquí ya demostró la contraseña: decirle que la cuenta está bloqueada no
        # revela nada a un extraño.
        session.rollback()
        raise AccountBlockedError

    now = datetime.datetime.now(datetime.UTC)
    if password_hash is not None and needs_rehash(password_hash):
        # Si los parámetros de Argon2id suben, cada cuenta se actualiza en su próximo ingreso.
        user.password_hash = hash_password(password)
    rate_limit.clear(session, rate_limit.LOGIN_ACCOUNT, email)
    membership = _enter_organization(session, user.id)
    organization_id = membership.organization_id if membership is not None else None

    refresh_token = secrets.token_urlsafe(_REFRESH_TOKEN_BYTES)
    family_id = uuid.uuid7()
    expires_at = now + SESSION_LIFETIME
    sessions_repository.add_refresh_token(
        session,
        RefreshToken(
            user_id=user.id,
            family_id=family_id,
            token_hash=refresh_token_hash(refresh_token),
            expires_at=expires_at,
        ),
    )
    _audit(session, "login", organization_id, user.id, client_ip, user_agent, now)
    session.commit()

    access_token = issue_access_token(key, user.id, family_id, ACCESS_TOKEN_LIFETIME, now=now)
    return IssuedSession(
        access_token=access_token, refresh_token=refresh_token, expires_at=expires_at
    )


def authenticate(session: Session, settings: Settings, access_token: str | None) -> Principal:
    """Comprueba el token de acceso y que su sesión siga viva, y deja fijado el contexto de
    la organización para el resto de la petición.

    La sesión se consulta en cada petición: cerrar las sesiones o bloquear la cuenta corta el
    acceso de inmediato, sin esperar a que el token venza (CA-HU-009-03).
    """
    if access_token is None:
        raise NotAuthenticatedError
    try:
        claims = read_access_token(settings.signing_key(), access_token)
    except InvalidAccessTokenError:
        raise NotAuthenticatedError from None
    legal_version = sessions_repository.accepted_legal_version(
        session, claims.subject, claims.session_id
    )
    if legal_version is None:
        raise NotAuthenticatedError

    membership = _enter_organization(session, claims.subject)
    return Principal(
        user_id=claims.subject,
        session_id=claims.session_id,
        organization_id=membership.organization_id if membership is not None else None,
        role=membership.role if membership is not None else None,
        legal_version=legal_version,
    )


def _record_failure(
    session: Session,
    user: User | None,
    email: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    rate_limit.record(session, rate_limit.LOGIN_IP, client_ip)
    rate_limit.record(session, rate_limit.LOGIN_ACCOUNT, email)
    # Un intento contra una cuenta real queda en la auditoría de su organización, donde el
    # propietario lo puede ver (HU-014). Uno contra un correo sin cuenta queda sin
    # organización: se guarda, pero ninguna organización lo lee.
    user_id = user.id if user is not None else None
    membership = _enter_organization(session, user_id) if user_id is not None else None
    organization_id = membership.organization_id if membership is not None else None
    now = datetime.datetime.now(datetime.UTC)
    _audit(session, "login_failed", organization_id, user_id, client_ip, user_agent, now)
    session.commit()


def _enter_organization(session: Session, user_id: uuid.UUID) -> Membership | None:
    """Fija el contexto de la persona y, si tiene organización, el de esa organización.

    Primero el de la persona, porque Row-Level Security solo le deja ver su propia membresía;
    después el de su organización, para leer y escribir en ella el resto de la transacción.
    """
    set_tenant(session, TenantContext(user_id=user_id))
    membership = accounts_repository.membership_of(session, user_id)
    if membership is not None:
        set_tenant(
            session, TenantContext(organization_id=membership.organization_id, user_id=user_id)
        )
    return membership


def _audit(
    session: Session,
    action: str,
    organization_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
    client_ip: str,
    user_agent: str | None,
    now: datetime.datetime,
) -> None:
    session.add(
        AuditLog(
            organization_id=organization_id,
            actor_user_id=user_id,
            action=action,
            target_id=user_id,
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
            created_at=now,
        )
    )
    session.flush()
