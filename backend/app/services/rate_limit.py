"""Límite de peticiones por cuenta y por IP (RN-026, RNF-006).

Cada intento que cuenta queda en rate_limit_events con el SHA-256 de su clave: el correo
normalizado o la IP. La ventana es deslizante, así que "5 intentos en 15 minutos" significa
exactamente eso, sin importar en qué minuto empezó la ráfaga.

Uso dentro de una sola transacción:

    rate_limit.check(session, LOGIN_ACCOUNT, correo)    # 429 si ya no quedan intentos
    ...                                                 # el trabajo protegido
    rate_limit.record(session, LOGIN_ACCOUNT, correo)   # solo si el intento cuenta
    session.commit()

check toma un candado por clave que dura hasta el commit: dos peticiones simultáneas con la
misma clave no pueden colarse a la vez por el último intento libre. Una cuenta inexistente
se limita igual que una real, así que la respuesta 429 no revela qué correos existen.
"""

import datetime
import hashlib
from dataclasses import dataclass
from typing import Final

from sqlalchemy.orm import Session

from app.repositories import rate_limits as rate_limits_repository


@dataclass(frozen=True, slots=True)
class Limit:
    """Cuántos intentos admite una clave dentro de una ventana de tiempo."""

    bucket: str
    max_attempts: int
    window: datetime.timedelta


_WINDOW: Final = datetime.timedelta(minutes=15)

# RN-026: 5 intentos fallidos por cuenta y 20 por IP cada 15 minutos. RNF-006 extiende el
# límite a registro, recuperación e invitaciones; ahí se usan los mismos topes.
LOGIN_ACCOUNT: Final = Limit("login_account", 5, _WINDOW)
LOGIN_IP: Final = Limit("login_ip", 20, _WINDOW)
REGISTER_IP: Final = Limit("register_ip", 20, _WINDOW)
EMAIL_VERIFICATION_ACCOUNT: Final = Limit("email_verification_account", 5, _WINDOW)
PASSWORD_RESET_ACCOUNT: Final = Limit("password_reset_account", 5, _WINDOW)
PASSWORD_RESET_IP: Final = Limit("password_reset_ip", 20, _WINDOW)
INVITATION_ACCOUNT: Final = Limit("invitation_account", 20, _WINDOW)

LIMITS: Final = (
    LOGIN_ACCOUNT,
    LOGIN_IP,
    REGISTER_IP,
    EMAIL_VERIFICATION_ACCOUNT,
    PASSWORD_RESET_ACCOUNT,
    PASSWORD_RESET_IP,
    INVITATION_ACCOUNT,
)
# Un intento más viejo que la ventana más larga ya no cuenta para ningún límite.
RETENTION: Final = max(limit.window for limit in LIMITS)


class RateLimitExceededError(Exception):
    """La clave agotó sus intentos; la API responde 429 con Retry-After."""

    def __init__(self, retry_after: int) -> None:
        super().__init__(f"Límite de peticiones alcanzado; reintentar en {retry_after} s.")
        self.retry_after = retry_after


def _key_hash(limit: Limit, value: str) -> bytes:
    # Sin mayúsculas ni espacios: Abogada@Example.com y abogada@example.com son la misma
    # cuenta. La IP no cambia con esto.
    return hashlib.sha256(value.strip().lower().encode()).digest()


def _lock_id(limit: Limit, key_hash: bytes) -> int:
    # El candado de PostgreSQL recibe un bigint: los primeros 8 bytes de un SHA-256 del
    # límite y la clave. Una colisión solo haría esperar a otra petición, nunca la dejaría pasar.
    digest = hashlib.sha256(limit.bucket.encode() + b":" + key_hash).digest()
    return int.from_bytes(digest[:8], "big", signed=True)


def check(session: Session, limit: Limit, value: str) -> None:
    """Lanza RateLimitExceededError si la clave ya agotó sus intentos.

    No registra nada: el intento se registra con record cuando corresponde.
    """
    key_hash = _key_hash(limit, value)
    rate_limits_repository.lock_key(session, _lock_id(limit, key_hash))
    retry_after = rate_limits_repository.seconds_until_free(
        session, limit.bucket, key_hash, limit.max_attempts, limit.window
    )
    if retry_after is not None:
        raise RateLimitExceededError(retry_after)


def record(session: Session, limit: Limit, value: str) -> None:
    """Registra un intento que cuenta para el límite."""
    rate_limits_repository.add_event(session, limit.bucket, _key_hash(limit, value))


def hit(session: Session, limit: Limit, value: str) -> None:
    """check y record juntos, para los límites en los que toda petición cuenta."""
    check(session, limit, value)
    record(session, limit, value)


def purge_expired(session: Session) -> int:
    """Borra los intentos que ya no cuentan para ningún límite. Lo ejecuta el trabajador."""
    return rate_limits_repository.delete_older_than(session, RETENTION)
