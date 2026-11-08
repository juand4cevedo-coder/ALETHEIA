"""Sesiones: ingreso con correo y contraseña (RF-008, HU-007), renovación con rotación,
cierre de la sesión y de todas las sesiones (RF-010, RF-011, HU-009) y la comprobación de
cada petición autenticada (RN-023, ADR-007, ADR-028 y ADR-033).

Al ingresar nacen dos credenciales, cada una en su cookie:

- el token de acceso, un JWT de 10 minutos firmado con la subclave de sesión, que lleva la
  familia de la sesión (app.core.tokens);
- el token de renovación, 32 bytes aleatorios de los que la base solo guarda el SHA-256.

Cada renovación gasta el token presentado y entrega uno nuevo de la misma familia, con el
mismo vencimiento: la sesión dura como máximo 14 días desde el ingreso, lo mismo que dice la
política de cookies. Un token ya gastado solo puede volver a llegar si alguien lo copió, así
que su reutilización revoca la familia completa: el ladrón y la persona quedan fuera, y ella
vuelve a entrar con su contraseña (CA-HU-009-02).

Para no revelar qué correos existen (RN-026), un correo sin cuenta, una cuenta sin contraseña
y una contraseña equivocada reciben el mismo error, pasan por el mismo hash Argon2id y cuentan
igual para el límite de intentos.
"""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.legal import LEGAL_VERSION
from app.core.passwords import check_password, hash_password, needs_rehash
from app.core.tokens import (
    InvalidAccessTokenError,
    issue_access_token,
    new_opaque_token,
    opaque_token_hash,
    read_access_token,
)
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Membership, RefreshToken, User
from app.repositories import accounts as accounts_repository
from app.repositories import sessions as sessions_repository
from app.services import rate_limit
from app.services.audit import audit_ip, audit_user_agent

ACCESS_TOKEN_LIFETIME: Final = datetime.timedelta(minutes=10)
SESSION_LIFETIME: Final = datetime.timedelta(days=14)
# El token de renovación es opaco (app.core.tokens) y un token legítimo mide 43 caracteres.
# Lo que pase de este tope se rechaza sin consultar la base ni calcular hashes de cuerpos
# enormes.
_MAX_REFRESH_TOKEN_LENGTH: Final = 64


class InvalidCredentialsError(Exception):
    """Correo o contraseña incorrectos. No dice cuál de los dos, ni si la cuenta existe."""


class AccountBlockedError(Exception):
    """La contraseña es correcta, pero la cuenta está bloqueada por la plataforma."""


class NotAuthenticatedError(Exception):
    """No hay una sesión válida: sin token, token alterado o vencido, o sesión cerrada."""


class RefreshRejectedError(Exception):
    """El token de renovación no sirve: falta, no existe, venció, se revocó o se reutilizó.

    Todas las causas dan el mismo 401: quien prueba tokens no aprende nada.
    """


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
    return opaque_token_hash(token)


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

    issued = _issue(session, key, user.id, uuid.uuid7(), expires_at=now + SESSION_LIFETIME, now=now)
    _audit(session, "login", organization_id, user.id, client_ip, user_agent, now)
    session.commit()
    return issued


def rotate(
    session: Session,
    settings: Settings,
    refresh_token: str | None,
    *,
    client_ip: str,
    user_agent: str | None,
) -> IssuedSession:
    """Gasta el token de renovación y entrega un par nuevo de la misma familia (API-008).

    Lanza RefreshRejectedError si el token falta, no existe, venció, se revocó, si la cuenta
    ya no está activa o si el token ya se había usado. En este último caso revoca antes la
    familia completa y lo deja en la auditoría como session_reuse_detected (CA-HU-009-02).
    """
    key = settings.signing_key()
    if not refresh_token or len(refresh_token) > _MAX_REFRESH_TOKEN_LENGTH:
        raise RefreshRejectedError
    current = sessions_repository.refresh_token_for_update(
        session, refresh_token_hash(refresh_token)
    )
    now = datetime.datetime.now(datetime.UTC)
    if current is None or current.revoked_at is not None or current.expires_at <= now:
        session.rollback()
        raise RefreshRejectedError
    if current.used_at is not None:
        # Este token ya se cambió por otro: quien lo presenta tiene una copia. No se sabe si
        # es la persona o un ladrón, así que la familia entera deja de servir.
        sessions_repository.revoke_family(session, current.family_id, now)
        membership = _enter_organization(session, current.user_id)
        organization_id = membership.organization_id if membership is not None else None
        _audit(
            session,
            "session_reuse_detected",
            organization_id,
            current.user_id,
            client_ip,
            user_agent,
            now,
        )
        session.commit()
        raise RefreshRejectedError
    user = session.get(User, current.user_id)
    if user is None or user.status != "active":
        session.rollback()
        raise RefreshRejectedError

    current.used_at = now
    issued = _issue(
        session, key, current.user_id, current.family_id, expires_at=current.expires_at, now=now
    )
    session.commit()
    return issued


def sign_out(
    session: Session, principal: Principal, *, client_ip: str, user_agent: str | None
) -> None:
    """Cierra la sesión desde la que se hace la petición (API-009).

    Revoca su familia: el token de acceso deja de servir en la petición siguiente, también si
    alguien tenía una copia.
    """
    now = datetime.datetime.now(datetime.UTC)
    sessions_repository.revoke_family(session, principal.session_id, now)
    _audit(
        session,
        "logout",
        principal.organization_id,
        principal.user_id,
        client_ip,
        user_agent,
        now,
    )
    session.commit()


def sign_out_everywhere(
    session: Session, principal: Principal, *, client_ip: str, user_agent: str | None
) -> None:
    """Cierra todas las sesiones de la persona, en todos sus dispositivos (API-010).

    Cada petición comprueba que su familia siga viva, así que los demás dispositivos quedan
    fuera en su siguiente petición, sin esperar a que venza su token de acceso (CA-HU-009-03).
    """
    now = datetime.datetime.now(datetime.UTC)
    sessions_repository.revoke_user_sessions(session, principal.user_id, now)
    _audit(
        session,
        "sessions_revoked",
        principal.organization_id,
        principal.user_id,
        client_ip,
        user_agent,
        now,
    )
    session.commit()


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


def _issue(
    session: Session,
    key: str,
    user_id: uuid.UUID,
    family_id: uuid.UUID,
    *,
    expires_at: datetime.datetime,
    now: datetime.datetime,
) -> IssuedSession:
    """Guarda el hash de un token de renovación nuevo y firma su acceso."""
    refresh_token = new_opaque_token()
    sessions_repository.add_refresh_token(
        session,
        RefreshToken(
            user_id=user_id,
            family_id=family_id,
            token_hash=refresh_token_hash(refresh_token),
            expires_at=expires_at,
        ),
    )
    access_token = issue_access_token(key, user_id, family_id, ACCESS_TOKEN_LIFETIME, now=now)
    return IssuedSession(
        access_token=access_token, refresh_token=refresh_token, expires_at=expires_at
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
