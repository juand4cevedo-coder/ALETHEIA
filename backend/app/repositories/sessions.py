"""Consultas de las sesiones: tokens de renovación y sus familias (DAT-03)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import RefreshToken, User


def add_refresh_token(session: Session, token: RefreshToken) -> None:
    """Guarda un token de renovación; de él solo se conoce su hash."""
    session.add(token)
    session.flush()


def accepted_legal_version(
    session: Session, user_id: uuid.UUID, family_id: uuid.UUID
) -> str | None:
    """Versión de los textos legales que aceptó la persona, si sigue activa y su familia de
    sesión no se revocó ni venció; None si no.

    Es la comprobación de cada petición autenticada: una sola consulta que usa los índices de
    users.id y refresh_tokens.family_id y que, de paso, trae lo que hace falta para exigir los
    textos vigentes (RN-029).
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
    # Los dos textos se aceptan juntos; si alguna vez difieren, cuenta el más antiguo.
    statement = select(func.least(User.terms_version, User.privacy_version)).where(
        User.id == user_id, User.status == "active", live_family
    )
    return session.scalar(statement)
