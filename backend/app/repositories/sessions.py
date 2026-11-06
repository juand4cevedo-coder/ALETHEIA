"""Consultas de las sesiones: tokens de renovación y sus familias (DAT-03)."""

import datetime
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import RefreshToken, User


def add_refresh_token(session: Session, token: RefreshToken) -> None:
    """Guarda un token de renovación; de él solo se conoce su hash."""
    session.add(token)
    session.flush()


def refresh_token_for_update(session: Session, token_hash: bytes) -> RefreshToken | None:
    """El token de renovación con ese hash, bloqueado hasta el commit, o None.

    El bloqueo pone en fila dos renovaciones simultáneas con el mismo token: la segunda espera
    a que la primera lo marque como usado y, al verlo usado, lo trata como reutilización.
    """
    statement = select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
    return session.scalar(statement)


def revoke_family(session: Session, family_id: uuid.UUID, now: datetime.datetime) -> None:
    """Revoca los tokens todavía vivos de una familia."""
    statement = (
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    session.execute(statement)


def revoke_user_sessions(session: Session, user_id: uuid.UUID, now: datetime.datetime) -> None:
    """Revoca todos los tokens vivos de una persona, en todas sus familias (RF-011).

    Usa el índice de refresh_tokens.user_id.
    """
    statement = (
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    session.execute(statement)


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
