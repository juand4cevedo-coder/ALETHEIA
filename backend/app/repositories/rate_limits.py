"""Consultas sobre los intentos del límite de peticiones (DAT-19)."""

import datetime

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.models import RateLimitEvent

# Candado de transacción: dos peticiones con la misma clave se atienden de una en una, así que
# ninguna cuenta los intentos mientras otra está a punto de registrar el suyo. Se libera solo
# al confirmar o deshacer la transacción.
_LOCK = text("SELECT pg_advisory_xact_lock(:lock_id)")


def lock_key(session: Session, lock_id: int) -> None:
    """Toma el candado de una clave hasta que termine la transacción actual."""
    session.execute(_LOCK, {"lock_id": lock_id})


def seconds_until_free(
    session: Session, bucket: str, key_hash: bytes, max_attempts: int, window: datetime.timedelta
) -> int | None:
    """Segundos hasta que la clave vuelva a tener un intento libre, o None si ya lo tiene.

    Con max_attempts intentos o más dentro de la ventana, la clave se libera cuando vence el
    intento número max_attempts contando desde el más reciente.
    """
    blocking = (
        select(RateLimitEvent.created_at)
        .where(
            RateLimitEvent.bucket == bucket,
            RateLimitEvent.key_hash == key_hash,
            RateLimitEvent.created_at > func.now() - window,
        )
        .order_by(RateLimitEvent.created_at.desc())
        .offset(max_attempts - 1)
        .limit(1)
        .scalar_subquery()
    )
    seconds = session.scalar(
        select(func.ceil(func.extract("epoch", blocking + window - func.now())))
    )
    if seconds is None:
        return None
    # Al menos un segundo: Retry-After: 0 invitaría a reintentar de inmediato.
    return max(int(seconds), 1)


def add_event(session: Session, bucket: str, key_hash: bytes) -> None:
    """Registra un intento con la hora de la transacción."""
    session.add(RateLimitEvent(bucket=bucket, key_hash=key_hash))
    session.flush()


def delete_older_than(session: Session, age: datetime.timedelta) -> int:
    """Borra los intentos más viejos que age y devuelve cuántos borró."""
    deleted = session.scalars(
        delete(RateLimitEvent)
        .where(RateLimitEvent.created_at < func.now() - age)
        .returning(RateLimitEvent.id)
    ).all()
    return len(deleted)
