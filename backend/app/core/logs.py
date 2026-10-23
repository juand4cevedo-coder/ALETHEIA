"""Registros estructurados en JSON, con el identificador de la petición en curso."""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any, Final, TextIO

# Identificador de la petición que se atiende; None fuera de una petición.
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

# Solo estos campos adicionales pasan al registro: nada llega a él por accidente.
_EXTRA_FIELDS: Final = ("method", "path", "status", "duration_ms")


class JsonFormatter(logging.Formatter):
    """Convierte cada registro en una línea JSON."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = request_id_var.get()
        if request_id is not None:
            entry["request_id"] = request_id
        for field in _EXTRA_FIELDS:
            if field in record.__dict__:
                entry[field] = record.__dict__[field]
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


class _AletheiaHandler(logging.StreamHandler[TextIO]):
    """Manejador propio, identificable para no instalarlo dos veces."""


def configure_logging(level: str) -> None:
    """Envía todos los registros a la salida estándar en JSON."""
    root = logging.getLogger()
    if not any(isinstance(handler, _AletheiaHandler) for handler in root.handlers):
        handler = _AletheiaHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        root.addHandler(handler)
    root.setLevel(level)
    # Uvicorn trae su propio formato: sus registros pasan al manejador raíz y su
    # registro de accesos se apaga, porque el middleware de peticiones lo reemplaza.
    for name in ("uvicorn", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True
    logging.getLogger("uvicorn.access").disabled = True
