"""Endpoint de salud (API-001): lo usan la prueba de humo y la comprobación externa."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import Engine

from app.api.deps import get_engine
from app.db.session import database_is_available
from app.schemas.health import HealthResponse

router = APIRouter(tags=["salud"])

_DATABASE_DOWN = "La base de datos no responde."


@router.get(
    "/health",
    summary="Estado del servicio y de la base de datos",
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"description": _DATABASE_DOWN}},
)
def health(response: Response, engine: Annotated[Engine, Depends(get_engine)]) -> HealthResponse:
    # Ningún intermediario debe guardar una respuesta de salud: tiene que ser la actual.
    response.headers["Cache-Control"] = "no-store"
    if not database_is_available(engine):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_DATABASE_DOWN,
            headers={"Cache-Control": "no-store"},
        )
    return HealthResponse(status="ok", database="ok")
