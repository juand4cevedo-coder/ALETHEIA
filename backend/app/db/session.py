"""Conexión a PostgreSQL mediante SQLAlchemy con el controlador psycopg 3."""

import logging
from typing import Final

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings

# Segundos máximos para abrir una conexión: el health check no debe quedarse colgado.
_CONNECT_TIMEOUT_SECONDS: Final = 5

# Límites de cada sesión de la aplicación y del trabajador. Una consulta que se dispara, una
# espera por un candado o una transacción olvidada abierta no pueden bloquear la base ni dejar
# sin conexiones al resto: PostgreSQL la corta y la petición termina con error. Las migraciones
# usan su propia conexión y no tienen estos límites.
_SESSION_LIMITS: Final = " ".join(
    (
        "-c statement_timeout=30s",
        "-c lock_timeout=10s",
        "-c idle_in_transaction_session_timeout=60s",
    )
)

logger = logging.getLogger(__name__)


def create_db_engine(settings: Settings) -> Engine:
    """Crea el motor de la aplicación; no abre conexiones hasta que se usa."""
    return create_engine(
        settings.database_url.get_secret_value().encoded_string(),
        # Descarta conexiones caídas del pool antes de entregarlas.
        pool_pre_ping=True,
        # Un error de SQL no repite los valores de la consulta: sin esto, la traza que queda en
        # los registros traería correos, nombres o hashes de contraseña de esa petición.
        hide_parameters=True,
        connect_args={
            "connect_timeout": _CONNECT_TIMEOUT_SECONDS,
            "options": _SESSION_LIMITS,
        },
    )


def database_is_available(engine: Engine) -> bool:
    """Indica si PostgreSQL responde a una consulta mínima."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        # Solo el tipo de error: el mensaje del controlador puede incluir datos de conexión.
        logger.error("La base de datos no responde: %s", type(exc).__name__)
        return False
    return True
