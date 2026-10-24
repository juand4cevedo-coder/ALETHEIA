"""Entorno de Alembic: conecta con el usuario dueño del esquema y aplica las migraciones."""

import logging
import sys
from typing import Final

from alembic import context
from sqlalchemy import Connection, create_engine, pool, text

from app.core.config import MigrationSettings
from app.core.logs import JsonFormatter
from app.db.base import Base

# Segundos para abrir la conexión: si la base no responde, la migración falla rápido.
_CONNECT_TIMEOUT_SECONDS: Final = 5
# Tiempo máximo esperando un bloqueo de tabla: una migración no deja la API detenida.
_LOCK_TIMEOUT: Final = "10s"

# Catálogo de tablas que Alembic compara con la base; los modelos se registran en Base.
target_metadata = Base.metadata


def _configure_logging() -> None:
    # Los registros van a la salida de errores en JSON: la salida estándar queda libre
    # para el SQL que genera el modo --sql.
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)


def _reject_privileged_user(connection: Connection) -> None:
    # Un superusuario quedaría como dueño de las tablas y se saltaría Row-Level Security:
    # las migraciones solo corren con el dueño del esquema, que no tiene esos privilegios.
    privileged = connection.execute(
        text("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user")
    ).scalar_one()
    if privileged:
        msg = "Las migraciones no se ejecutan como superusuario: usa el dueño del esquema."
        raise RuntimeError(msg)


def run_migrations_offline() -> None:
    """Escribe el SQL de las migraciones sin conectarse, para revisarlo antes de aplicarlo."""
    context.configure(
        dialect_name="postgresql",
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Aplica las migraciones en una sola transacción: o se aplican todas o ninguna."""
    settings = MigrationSettings()
    # La URL se entrega directo al motor y no a la configuración de Alembic, que trata el
    # símbolo % como interpolación y la mostraría en sus mensajes.
    engine = create_engine(
        settings.database_url.get_secret_value().encoded_string(),
        # Una migración usa una conexión y la cierra: no necesita pool.
        poolclass=pool.NullPool,
        connect_args={
            "connect_timeout": _CONNECT_TIMEOUT_SECONDS,
            "options": f"-c lock_timeout={_LOCK_TIMEOUT}",
        },
    )
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            # Dentro de la transacción de Alembic: una consulta previa abriría otra transacción
            # y Alembic no confirmaría las migraciones.
            _reject_privileged_user(connection)
            context.run_migrations()


_configure_logging()
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
