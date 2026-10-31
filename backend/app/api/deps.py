"""Dependencias compartidas por las rutas de la API."""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import Engine
from sqlalchemy.orm import Session


def get_engine(request: Request) -> Engine:
    """Entrega el motor de base de datos creado al construir la aplicación."""
    engine = request.app.state.engine
    if not isinstance(engine, Engine):
        msg = "La aplicación no tiene motor de base de datos"
        raise TypeError(msg)
    return engine


def get_session(engine: Annotated[Engine, Depends(get_engine)]) -> Iterator[Session]:
    """Sesión de SQLAlchemy por petición; se cierra al terminar la respuesta."""
    with Session(engine) as session:
        yield session
