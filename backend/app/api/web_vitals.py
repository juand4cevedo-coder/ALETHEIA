"""Entrega de las medidas de rendimiento reales (ADR-052).

Es una ruta pública y sin sesión a propósito: la interfaz la llama solo si la persona aceptó la
categoría «analítica» del panel de cookies, y lo que recibe no identifica a nadie. Por eso
tampoco usa cookies ni deja la IP: el límite guarda un resumen irreversible de ella, como los
demás límites de peticiones, y se borra a los 15 minutos.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_session
from app.schemas.web_vitals import VitalsReport
from app.services import rate_limit
from app.services import web_vitals as vitals_service

router = APIRouter(tags=["rendimiento"])


@router.post(
    "/web-vitals",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Entregar las medidas de rendimiento de una visita",
    responses={status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiadas entregas."}},
)
def submit_web_vitals(
    report: VitalsReport,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> Response:
    rate_limit.hit(session, rate_limit.VITALS_IP, client_ip)
    vitals_service.record(session, request.app.version, report)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})
