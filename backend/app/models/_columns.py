"""Columnas que comparten varias tablas."""

import datetime
import uuid
from typing import Annotated

from sqlalchemy import func
from sqlalchemy.orm import mapped_column

# Identificador UUID v7: lo genera la aplicación y se ordena por fecha de creación (ADR-009).
UUIDv7Pk = Annotated[uuid.UUID, mapped_column(primary_key=True, default=uuid.uuid7)]

# Momento de creación en UTC, puesto por PostgreSQL dentro de la misma transacción.
CreatedAt = Annotated[datetime.datetime, mapped_column(server_default=func.now())]


def text_values(column: str, values: tuple[str, ...]) -> str:
    """Expresión SQL de una restricción CHECK que limita una columna a una lista cerrada."""
    allowed = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({allowed})"
