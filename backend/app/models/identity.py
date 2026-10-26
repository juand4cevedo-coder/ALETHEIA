"""Identidad: cuentas, vínculos con Google, sesiones y auditoría de seguridad."""

import datetime
import uuid
from typing import Final

from sqlalchemy import CheckConstraint, ForeignKey, Index, func, text
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk, text_values

USER_STATUSES: Final = ("active", "blocked")


def _utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


# Lista cerrada de eventos de seguridad (RF-017). Agregar uno exige una migración.
AUDIT_ACTIONS: Final = (
    "user_registered",
    "email_verified",
    "login",
    "login_failed",
    "google_linked",
    "session_reuse_detected",
    "sessions_revoked",
    "password_reset",
    "password_changed",
    "invitation_sent",
    "invitation_revoked",
    "invitation_accepted",
    "role_changed",
    "member_removed",
    "plan_changed",
    "subscription_canceled",
    "account_blocked",
    "account_unblocked",
)


class User(Base):
    """Cuenta de una persona (DAT-01)."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "char_length(email) <= 254 AND position('@' IN email) > 1", name="email_format"
        ),
        # Solo se acepta el formato PHC de Argon2id: una contraseña en claro no cabe aquí.
        CheckConstraint("password_hash LIKE '$argon2id$%'", name="password_hash_argon2id"),
        CheckConstraint("char_length(full_name) BETWEEN 1 AND 120", name="full_name_length"),
        CheckConstraint(text_values("status", USER_STATUSES), name="status"),
        CheckConstraint("char_length(terms_version) BETWEEN 1 AND 20", name="terms_version"),
        CheckConstraint("char_length(privacy_version) BETWEEN 1 AND 20", name="privacy_version"),
        # El correo es único sin distinguir mayúsculas (IDX-001).
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
    )

    id: Mapped[UUIDv7Pk]
    email: Mapped[str]
    email_verified_at: Mapped[datetime.datetime | None]
    password_hash: Mapped[str | None]
    full_name: Mapped[str]
    status: Mapped[str] = mapped_column(server_default="active")
    is_platform_admin: Mapped[bool] = mapped_column(server_default="false")
    terms_version: Mapped[str]
    privacy_version: Mapped[str]
    consented_at: Mapped[datetime.datetime]
    created_at: Mapped[CreatedAt]
    updated_at: Mapped[datetime.datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class OAuthIdentity(Base):
    """Vínculo de una cuenta con Google por su identificador sub (DAT-02, RN-024)."""

    __tablename__ = "oauth_identities"
    __table_args__ = (
        CheckConstraint("provider = 'google'", name="provider"),
        CheckConstraint("char_length(subject) BETWEEN 1 AND 255", name="subject_length"),
        Index("uq_oauth_identities_provider_subject", "provider", "subject", unique=True),
    )

    id: Mapped[UUIDv7Pk]
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    provider: Mapped[str]
    subject: Mapped[str]
    created_at: Mapped[CreatedAt]


class RefreshToken(Base):
    """Sesión revocable; se guarda el hash SHA-256 del token, nunca el token (DAT-03)."""

    __tablename__ = "refresh_tokens"
    __table_args__ = (CheckConstraint("octet_length(token_hash) = 32", name="token_hash_sha256"),)

    id: Mapped[UUIDv7Pk]
    # Índice para cerrar todas las sesiones de una persona (RF-011).
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Toda la cadena de rotación comparte familia: si se reutiliza un token, cae la familia.
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    token_hash: Mapped[bytes] = mapped_column(unique=True)
    expires_at: Mapped[datetime.datetime]
    used_at: Mapped[datetime.datetime | None]
    revoked_at: Mapped[datetime.datetime | None]
    created_at: Mapped[CreatedAt]


class AuditLog(Base):
    """Evento de seguridad de cuenta u organización (DAT-04)."""

    __tablename__ = "audit_log"
    __table_args__ = (
        CheckConstraint(text_values("action", AUDIT_ACTIONS), name="action"),
        CheckConstraint("char_length(user_agent) <= 300", name="user_agent_length"),
        # Auditoría de una organización ordenada por fecha (IDX-011).
        Index("ix_audit_log_organization_id_created_at", "organization_id", "created_at"),
    )

    id: Mapped[UUIDv7Pk]
    # Nulo en eventos sin organización, como un ingreso fallido.
    organization_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id"))
    # Si la cuenta se elimina, el evento queda sin autor en lugar de desaparecer.
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    action: Mapped[str]
    target_id: Mapped[uuid.UUID | None]
    # IP y navegador se anonimizan a los 90 días (RN-027).
    ip: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None]
    # La fecha la pone la aplicación, no la base: así el INSERT no necesita leer la fila de
    # vuelta, algo que Row-Level Security impide con los eventos sin organización.
    created_at: Mapped[datetime.datetime] = mapped_column(
        default=_utc_now, server_default=func.now()
    )
