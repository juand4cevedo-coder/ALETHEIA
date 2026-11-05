"""Consultas de las sesiones: tokens de renovación y sus familias (DAT-03)."""

import uuid

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.models import RefreshToken, User


def add_refresh_token(session: Session, token: RefreshToken) -> None:
    """Guarda un token de renovación; de él solo se conoce su hash."""
    session.add(token)
    session.flush()


def session_is_active(session: Session, user_id: uuid.UUID, family_id: uuid.UUID) -> bool:
    """Indica si la persona sigue activa y su familia de sesión no se revocó ni venció.

    Es la comprobación de cada petición autenticada: una sola consulta que usa los índices de
    users.id y refresh_tokens.family_id.
    """
    live_family = (
        select(RefreshToken.id)
        .where(
            RefreshToken.family_id == family_id,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > func.now(),
        )
        .exists()
    )
    statement = select(exists().where(User.id == user_id, User.status == "active", live_family))
    return bool(session.scalar(statement))
