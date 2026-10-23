"""Conexión a PostgreSQL mediante SQLAlchemy con el controlador psycopg 3."""

import logging
from typing import Final

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings

# Segundos máximos para abrir una conexión: el health check no debe quedarse colgado.
_CONNECT_TIMEOUT_SECONDS: Final = 5

logger = logging.getLogger(__name__)


def create_db_engine(settings: Settings) -> Engine:
    """Crea el motor de la aplicación; no abre conexiones hasta que se usa."""
    return create_engine(
        settings.database_url.get_secret_value().encoded_string(),
        # Descarta conexiones caídas del pool antes de entregarlas.
        pool_pre_ping=True,
        connect_args={"connect_timeout": _CONNECT_TIMEOUT_SECONDS},
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
