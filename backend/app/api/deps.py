"""Dependencias compartidas por las rutas de la API."""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.core.config import Settings


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


def get_app_settings(request: Request) -> Settings:
    """La configuración de la aplicación que atiende la petición."""
    settings: Settings = request.app.state.settings
    return settings


def get_client_ip(request: Request) -> str:
    """IP de quien llama. En producción uvicorn la toma de X-Forwarded-For, que Caddy reemplaza
    con la IP real del visitante; nunca la del propio Caddy."""
    if request.client is None:
        # Solo ocurre fuera de un servidor HTTP real; todas esas llamadas comparten un límite.
        return "desconocida"
    return request.client.host
