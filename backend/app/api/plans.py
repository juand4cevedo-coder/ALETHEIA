"""Catálogo público de planes (API-002): lo consume la página de precios."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.schemas.plans import PublicPlan
from app.services import plans as plans_service

router = APIRouter(tags=["planes"])


@router.get(
    "/plans",
    summary="Catálogo público de planes",
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "El catálogo no está disponible."}
    },
)
def list_plans(
    response: Response, session: Annotated[Session, Depends(get_session)]
) -> list[PublicPlan]:
    # Un minuto en caché: un cambio de precio se ve casi de inmediato y una visita que recorre
    # varias páginas no repite la consulta.
    response.headers["Cache-Control"] = "public, max-age=60"
    return plans_service.public_catalog(session)
