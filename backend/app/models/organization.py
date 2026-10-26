"""Organización: clientes de ALETHEIA, sus miembros y las invitaciones."""

import datetime
import uuid
from typing import Final

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk, text_values

ORGANIZATION_STATUSES: Final = ("active", "read_only", "suspended")
MEMBER_ROLES: Final = ("owner", "admin", "lawyer", "assistant")
# El propietario no se invita: nace con la organización (RN-010).
INVITABLE_ROLES: Final = ("admin", "lawyer", "assistant")


class Organization(Base):
    """Cliente de ALETHEIA: una oficina o firma (DAT-05)."""

    __tablename__ = "organizations"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 1 AND 120", name="name_length"),
        CheckConstraint(text_values("status", ORGANIZATION_STATUSES), name="status"),
        CheckConstraint("storage_used_bytes >= 0", name="storage_used_bytes"),
    )

    id: Mapped[UUIDv7Pk]
    name: Mapped[str]
    status: Mapped[str] = mapped_column(server_default="active")
    # Se actualiza en la misma transacción de cada subida.
    storage_used_bytes: Mapped[int] = mapped_column(BigInteger, server_default="0")
    created_at: Mapped[CreatedAt]


class Membership(Base):
    """Rol de una persona en su organización (DAT-06)."""

    __tablename__ = "memberships"
    __table_args__ = (
        CheckConstraint(text_values("role", MEMBER_ROLES), name="role"),
        # Exactamente un propietario por organización (IDX-004, RN-010).
        Index(
            "uq_memberships_organization_id_owner",
            "organization_id",
            unique=True,
            postgresql_where=text("role = 'owner'"),
        ),
    )

    id: Mapped[UUIDv7Pk]
    # Una organización con miembros no se puede borrar.
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT")
    )
    # Una persona pertenece a una sola organización en la versión 1.0.0 (RN-011).
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), unique=True
    )
    role: Mapped[str]
    created_at: Mapped[CreatedAt]


class Invitation(Base):
    """Invitación por correo de un solo uso que vence a las 72 horas (DAT-07, RN-012)."""

    __tablename__ = "invitations"
    __table_args__ = (
        CheckConstraint(
            "char_length(email) <= 254 AND position('@' IN email) > 1", name="email_format"
        ),
        CheckConstraint(text_values("role", INVITABLE_ROLES), name="role"),
        CheckConstraint("octet_length(token_hash) = 32", name="token_hash_sha256"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    email: Mapped[str]
    role: Mapped[str]
    token_hash: Mapped[bytes] = mapped_column(unique=True)
    invited_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime.datetime]
    accepted_at: Mapped[datetime.datetime | None]
    revoked_at: Mapped[datetime.datetime | None]
