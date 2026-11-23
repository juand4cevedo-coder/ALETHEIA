"""Segundo factor de una persona: el secreto TOTP cifrado y sus códigos de respaldo."""

import datetime
import uuid

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Index,
    LargeBinary,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk


class UserTwoFactor(Base):
    """Secreto de la persona. Mientras enabled_at es nulo, la activación está a medias."""

    __tablename__ = "user_two_factor"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    secret_encrypted: Mapped[bytes] = mapped_column(LargeBinary)
    enabled_at: Mapped[datetime.datetime | None]
    # Último paso de 30 segundos aceptado: impide reutilizar un código.
    last_step: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[CreatedAt]


class TwoFactorRecoveryCode(Base):
    """Un código de respaldo de un solo uso, guardado solo como HMAC."""

    __tablename__ = "two_factor_recovery_codes"
    __table_args__ = (
        CheckConstraint("octet_length(code_hash) = 32", name="code_hash"),
        UniqueConstraint("user_id", "code_hash"),
        Index("ix_two_factor_recovery_codes_user_id", "user_id"),
    )

    id: Mapped[UUIDv7Pk]
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    code_hash: Mapped[bytes] = mapped_column(LargeBinary)
    used_at: Mapped[datetime.datetime | None]
    created_at: Mapped[CreatedAt]


class TwoFactorRecovery(Base):
    """Pedido de recuperar el segundo factor de una persona que perdió el teléfono y los códigos.

    Nace cuando la persona confirma el pedido con el enlace del correo y su contraseña. Desde ahí
    corre una espera de seguridad: available_at es el primer momento en que puede terminar la
    recuperación, y el enlace de cancelación sirve a ella y a los dueños del despacho mientras
    la fila siga abierta (ni cancelada ni completada). Si available_at pasa y nadie la termina,
    deja de valer en expires_at.
    """

    __tablename__ = "two_factor_recoveries"
    __table_args__ = (
        CheckConstraint("available_at > created_at", name="available_after_created"),
        CheckConstraint("expires_at > available_at", name="expires_after_available"),
        # Una sola recuperación abierta por persona: pedir otra no reinicia la espera.
        Index(
            "uq_two_factor_recoveries_open_user",
            "user_id",
            unique=True,
            postgresql_where=text("canceled_at IS NULL AND completed_at IS NULL"),
        ),
    )

    id: Mapped[UUIDv7Pk]
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[CreatedAt]
    available_at: Mapped[datetime.datetime]
    expires_at: Mapped[datetime.datetime]
    canceled_at: Mapped[datetime.datetime | None]
    completed_at: Mapped[datetime.datetime | None]
