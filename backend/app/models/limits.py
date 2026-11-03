"""Operación: intentos que cuentan para el límite de peticiones (RN-026, RNF-006)."""

from sqlalchemy import CheckConstraint, Index
from sqlalchemy.orm import Mapped

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk


class RateLimitEvent(Base):
    """Un intento que cuenta para un límite (DAT-19).

    La clave es el SHA-256 del valor limitado, como el correo normalizado o la IP: la tabla no
    guarda correos ni direcciones en claro. Cada fila vive lo que dura la ventana más larga;
    después el trabajador la borra.
    """

    __tablename__ = "rate_limit_events"
    __table_args__ = (
        # Nombre del límite, como login_account o login_ip. Los topes viven en el código.
        CheckConstraint("bucket ~ '^[a-z][a-z_]{0,39}$'", name="bucket_format"),
        CheckConstraint("octet_length(key_hash) = 32", name="key_hash_length"),
        # Cuenta los intentos de una clave dentro de la ventana sin recorrer la tabla (IDX-012).
        Index(
            "ix_rate_limit_events_bucket_key_hash_created_at", "bucket", "key_hash", "created_at"
        ),
    )

    id: Mapped[UUIDv7Pk]
    bucket: Mapped[str]
    key_hash: Mapped[bytes]
    created_at: Mapped[CreatedAt]
