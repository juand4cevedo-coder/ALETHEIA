"""Portal del cliente: acceso por correo a lo que el despacho decide compartir (ADR-054)."""

import datetime
import uuid

from sqlalchemy import CheckConstraint, ForeignKey, ForeignKeyConstraint, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk


class ClientPortalAccess(Base):
    """Un cliente con acceso a un caso. El enlace no se guarda: va firmado con la versión de
    esta fila, así que reenviarlo invalida el anterior y revocar el acceso invalida todos."""

    __tablename__ = "client_portal_accesses"
    __table_args__ = (
        CheckConstraint("char_length(client_name) BETWEEN 1 AND 120", name="client_name"),
        CheckConstraint("char_length(client_email) BETWEEN 3 AND 254", name="client_email"),
        CheckConstraint("link_version >= 1", name="link_version"),
        ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
        ),
        # Un cliente tiene un solo acceso vigente por caso: invitarlo otra vez lo reenvía.
        Index(
            "uq_client_portal_accesses_open",
            "case_id",
            "client_email",
            unique=True,
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    case_id: Mapped[uuid.UUID]
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    client_name: Mapped[str]
    client_email: Mapped[str]
    link_version: Mapped[int] = mapped_column(server_default="1")
    expires_at: Mapped[datetime.datetime]
    revoked_at: Mapped[datetime.datetime | None]
    revoked_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    notice_accepted_at: Mapped[datetime.datetime | None]
    last_visit_at: Mapped[datetime.datetime | None]
    created_at: Mapped[CreatedAt]


class ClientPortalUpdate(Base):
    """Un aviso que el despacho decide mostrar al cliente. Solo se agregan: una corrección es un
    aviso nuevo. Nada del expediente llega al portal si no está aquí."""

    __tablename__ = "client_portal_updates"
    __table_args__ = (
        CheckConstraint("char_length(body) BETWEEN 1 AND 2000", name="body_length"),
        ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
        ),
        Index("ix_client_portal_updates_case_id_id", "case_id", "id"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    case_id: Mapped[uuid.UUID]
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    body: Mapped[str]
    created_at: Mapped[CreatedAt]
