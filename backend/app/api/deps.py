"""Dependencias compartidas por las rutas de la API."""

from fastapi import Request
from sqlalchemy import Engine


def get_engine(request: Request) -> Engine:
    """Entrega el motor de base de datos creado al construir la aplicación."""
    engine = request.app.state.engine
    if not isinstance(engine, Engine):
        msg = "La aplicación no tiene motor de base de datos"
        raise TypeError(msg)
    return engine
