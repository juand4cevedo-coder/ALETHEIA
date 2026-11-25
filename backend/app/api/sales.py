"""Solicitudes de cotización del plan Corporativo (formulario público de /empresa)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.captcha import require_captcha
from app.api.deps import get_client_ip, get_session
from app.schemas.sales import SalesInquiryAccepted, SalesInquiryCreate
from app.services import sales_inquiries

router = APIRouter(tags=["comercial"])


@router.post(
    "/sales-inquiries",
    dependencies=[Depends(require_captcha)],
    status_code=status.HTTP_201_CREATED,
    summary="Pedir una cotización del plan Corporativo",
    responses={
        status.HTTP_400_BAD_REQUEST: {"description": "Falta la verificación de persona."},
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiadas solicitudes."},
    },
)
def create_sales_inquiry(
    body: SalesInquiryCreate,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> SalesInquiryAccepted:
    response.headers["Cache-Control"] = "no-store"
    filing_number = sales_inquiries.open_inquiry(session, body, client_ip)
    session.commit()
    return SalesInquiryAccepted(
        filing_number=filing_number,
        detail="Recibimos su solicitud. Le escribiremos al correo que dejó.",
    )
