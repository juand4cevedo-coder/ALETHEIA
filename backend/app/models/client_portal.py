"""Portal del cliente: acceso por correo a lo que el despacho decide compartir (ADR-054)."""

import datetime
import uuid

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, ForeignKeyConstraint, Index, text
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


class ClientPortalMessage(Base):
    """Un mensaje de texto del cliente al despacho. Solo se agregan, sin archivos: el abogado
    responde con un aviso o por sus canales de siempre."""

    __tablename__ = "client_portal_messages"
    __table_args__ = (
        CheckConstraint("char_length(body) BETWEEN 1 AND 2000", name="body_length"),
        ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(["access_id"], ["client_portal_accesses.id"], ondelete="CASCADE"),
        Index("ix_client_portal_messages_case_id_id", "case_id", "id"),
        Index("ix_client_portal_messages_access_id_id", "access_id", "id"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    case_id: Mapped[uuid.UUID]
    access_id: Mapped[uuid.UUID]
    body: Mapped[str]
    read_at: Mapped[datetime.datetime | None]
    created_at: Mapped[CreatedAt]


class ClientPortalDocument(Base):
    """Una copia que el despacho sube aparte para el cliente. No es evidencia: no entra a la
    cadena de custodia ni se mezcla con los originales. Va cifrada con la llave del caso."""

    __tablename__ = "client_portal_documents"
    __table_args__ = (
        CheckConstraint("char_length(filename) BETWEEN 1 AND 255", name="filename_length"),
        CheckConstraint("octet_length(sha256) = 32", name="sha256_length"),
        CheckConstraint("size_bytes > 0", name="size_bytes"),
        CheckConstraint("char_length(storage_key) BETWEEN 1 AND 200", name="storage_key_length"),
        ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
        ),
        Index("ix_client_portal_documents_case_id_id", "case_id", "id"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    case_id: Mapped[uuid.UUID]
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    filename: Mapped[str]
    content_type: Mapped[str]
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[bytes]
    storage_key: Mapped[str] = mapped_column(unique=True)
    removed_at: Mapped[datetime.datetime | None]
    removed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    created_at: Mapped[CreatedAt]
