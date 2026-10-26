"""Evidencia: casos, sus miembros, evidencias, cadena de custodia, paquetes y constancias."""

import datetime
import uuid
from typing import Any, Final

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk, text_values

CASE_STATUSES: Final = ("open", "closed", "deleting")
# Tipo que declara quien sube la evidencia; la interfaz lo muestra en español.
DECLARED_TYPES: Final = ("chat", "email", "audio", "image", "document", "other")
TSA_STATUSES: Final = ("pending", "stamped", "failed")
EXPORT_STATUSES: Final = ("queued", "building", "ready", "failed", "expired")
# Lista cerrada de acciones de la cadena de custodia (RN-006). Agregar una exige una migración.
CUSTODY_ACTIONS: Final = (
    "case_created",
    "member_added",
    "member_removed",
    "evidence_uploaded",
    "evidence_stamped",
    "evidence_stamp_failed",
    "evidence_downloaded",
    "export_requested",
    "export_ready",
    "export_downloaded",
    "chain_verified",
    "case_closed",
    "deletion_requested",
)

# Las tablas hijas de un caso repiten organization_id para el aislamiento por organización.
# Esta llave foránea compuesta impide que una fila quede en una organización distinta a la
# de su caso.
_SAME_ORGANIZATION_AS_CASE = ("organization_id", "case_id"), ("cases.organization_id", "cases.id")


class Case(Base):
    """Caso o expediente de una organización (DAT-11)."""

    __tablename__ = "cases"
    __table_args__ = (
        CheckConstraint("char_length(title) BETWEEN 1 AND 160", name="title_length"),
        CheckConstraint(
            "char_length(internal_reference) BETWEEN 1 AND 80", name="internal_reference_length"
        ),
        CheckConstraint(text_values("status", CASE_STATUSES), name="status"),
        CheckConstraint("char_length(key_version) BETWEEN 1 AND 120", name="key_version_length"),
        CheckConstraint("custody_seq >= 0", name="custody_seq"),
        # Un caso abierto no tiene fecha de cierre; uno cerrado o en eliminación sí (RN-020).
        CheckConstraint("(status = 'open') = (closed_at IS NULL)", name="closed_at"),
        # La llave solo puede faltar cuando el caso ya se está eliminando.
        CheckConstraint("wrapped_key IS NOT NULL OR status = 'deleting'", name="wrapped_key"),
        # Lista los casos de una organización por cursor (IDX-006) y sirve de destino a las
        # llaves compuestas de las tablas hijas.
        UniqueConstraint("organization_id", "id"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    title: Mapped[str]
    internal_reference: Mapped[str | None]
    status: Mapped[str] = mapped_column(server_default="open")
    # Llave de datos del caso, envuelta por la llave maestra de Key Vault. Nunca en claro.
    wrapped_key: Mapped[bytes | None]
    key_version: Mapped[str]
    # Número del último evento de custodia; lo avanza el trigger de la cadena.
    custody_seq: Mapped[int] = mapped_column(server_default="0")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[CreatedAt]
    closed_at: Mapped[datetime.datetime | None]


class CaseMember(Base):
    """Persona asignada a un caso (DAT-12)."""

    __tablename__ = "case_members"
    __table_args__ = (ForeignKeyConstraint(*_SAME_ORGANIZATION_AS_CASE),)

    case_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    # Índice para listar los casos de una persona (IDX-005).
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True, index=True)
    organization_id: Mapped[uuid.UUID]
    added_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    added_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())


class Evidence(Base):
    """Metadatos de un archivo preservado; el contenido cifrado vive en Blob Storage (DAT-13)."""

    __tablename__ = "evidences"
    __table_args__ = (
        CheckConstraint("octet_length(sha256) = 32", name="sha256_length"),
        CheckConstraint("size_bytes > 0", name="size_bytes"),
        CheckConstraint(
            "char_length(original_filename) BETWEEN 1 AND 255", name="original_filename_length"
        ),
        CheckConstraint(text_values("declared_type", DECLARED_TYPES), name="declared_type"),
        CheckConstraint(
            "char_length(detected_type) BETWEEN 1 AND 120", name="detected_type_length"
        ),
        CheckConstraint(
            "char_length(declared_origin) BETWEEN 1 AND 500", name="declared_origin_length"
        ),
        CheckConstraint("char_length(storage_key) BETWEEN 1 AND 200", name="storage_key_length"),
        CheckConstraint(text_values("tsa_status", TSA_STATUSES), name="tsa_status"),
        # Una evidencia sellada guarda el sello y su hora.
        CheckConstraint(
            "tsa_status <> 'stamped' OR (tsa_token IS NOT NULL AND tsa_time IS NOT NULL)",
            name="tsa_stamped",
        ),
        ForeignKeyConstraint(*_SAME_ORGANIZATION_AS_CASE),
        # Evidencias de un caso por cursor (IDX-007) y destino de la llave de la custodia.
        UniqueConstraint("case_id", "id"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    case_id: Mapped[uuid.UUID]
    # Huella SHA-256 de los bytes recibidos, antes de cifrar (RN-003).
    sha256: Mapped[bytes]
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    original_filename: Mapped[str]
    declared_type: Mapped[str]
    detected_type: Mapped[str]
    # Procedencia que declara el usuario; se registra sin verificarla (RN-005).
    declared_origin: Mapped[str]
    storage_key: Mapped[str] = mapped_column(unique=True)
    tsa_status: Mapped[str] = mapped_column(server_default="pending")
    # Respuesta RFC 3161 tal cual la entrega la autoridad de sellado.
    tsa_token: Mapped[bytes | None]
    tsa_time: Mapped[datetime.datetime | None]
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())


class CustodyEvent(Base):
    """Evento de la cadena de custodia de un caso; solo se inserta (DAT-15, RN-006)."""

    __tablename__ = "custody_events"
    __table_args__ = (
        CheckConstraint("seq >= 1", name="seq"),
        CheckConstraint(text_values("action", CUSTODY_ACTIONS), name="action"),
        CheckConstraint("octet_length(prev_hash) = 32", name="prev_hash_length"),
        CheckConstraint("octet_length(event_hash) = 32", name="event_hash_length"),
        ForeignKeyConstraint(*_SAME_ORGANIZATION_AS_CASE),
        # La evidencia del evento pertenece al mismo caso.
        ForeignKeyConstraint(("case_id", "evidence_id"), ("evidences.case_id", "evidences.id")),
        # Orden y verificación de la cadena: un número por posición, sin repetir (IDX-008).
        UniqueConstraint("case_id", "seq"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    case_id: Mapped[uuid.UUID]
    seq: Mapped[int]
    evidence_id: Mapped[uuid.UUID | None]
    # Nulo en eventos del sistema, como el sellado de tiempo.
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str]
    # Datos del evento, nunca contenido de archivos.
    details: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # Lo fija la aplicación, porque forma parte de lo que se firma con event_hash.
    occurred_at: Mapped[datetime.datetime]
    # Hash del evento anterior; 32 bytes en cero en el primero.
    prev_hash: Mapped[bytes]
    # SHA-256 de la serialización canónica de este evento.
    event_hash: Mapped[bytes]


class Export(Base):
    """Paquete de preservación de un caso; su enlace vence a las 24 horas (DAT-16, RN-021)."""

    __tablename__ = "exports"
    __table_args__ = (
        CheckConstraint(text_values("status", EXPORT_STATUSES), name="status"),
        CheckConstraint(
            "manifest_sha256 IS NULL OR octet_length(manifest_sha256) = 32",
            name="manifest_sha256_length",
        ),
        CheckConstraint("char_length(storage_key) BETWEEN 1 AND 200", name="storage_key_length"),
        # Un paquete listo tiene manifiesto, objeto y vencimiento.
        CheckConstraint(
            "status <> 'ready' OR (manifest_sha256 IS NOT NULL AND storage_key IS NOT NULL "
            "AND expires_at IS NOT NULL)",
            name="ready",
        ),
        ForeignKeyConstraint(*_SAME_ORGANIZATION_AS_CASE),
        Index("ix_exports_case_id_id", "case_id", "id"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    case_id: Mapped[uuid.UUID]
    requested_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(server_default="queued")
    manifest_sha256: Mapped[bytes | None]
    storage_key: Mapped[str | None]
    expires_at: Mapped[datetime.datetime | None]
    created_at: Mapped[CreatedAt]


class DeletionRecord(Base):
    """Constancia de eliminación de un caso; sobrevive al caso y nunca se borra (DAT-17)."""

    __tablename__ = "deletion_records"
    __table_args__ = (
        CheckConstraint("evidence_count >= 0", name="evidence_count"),
        CheckConstraint("total_bytes >= 0", name="total_bytes"),
        CheckConstraint("backups_expire_at >= key_destroyed_at", name="backups_expire_at"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    # Sin llave foránea: el caso ya no existe. Única: un caso se elimina una sola vez.
    case_id: Mapped[uuid.UUID] = mapped_column(unique=True)
    evidence_count: Mapped[int]
    total_bytes: Mapped[int] = mapped_column(BigInteger)
    # Huellas en hexadecimal, sin nombres de archivo.
    evidence_hashes: Mapped[list[str]] = mapped_column(JSONB)
    requested_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    key_destroyed_at: Mapped[datetime.datetime]
    # Desde cuándo el contenido es irrecuperable también en los respaldos.
    backups_expire_at: Mapped[datetime.datetime]
