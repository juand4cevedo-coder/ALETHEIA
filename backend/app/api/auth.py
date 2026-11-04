"""Cuenta y acceso: registro (API-003)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_session
from app.schemas.auth import RegisterRequest, RegistrationAccepted
from app.services import accounts as accounts_service

router = APIRouter(tags=["cuenta"])

_REGISTRATION_ACCEPTED = (
    "Si el correo puede usarse, le enviamos un enlace para verificarlo. Revise su bandeja de "
    "entrada y la carpeta de spam."
)


@router.post(
    "/auth/register",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Crear una cuenta con su organización y la prueba gratis",
    responses={
        status.HTTP_409_CONFLICT: {
            "description": "Los textos legales cambiaron; hay que recargar."
        },
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiados registros desde esta IP."},
    },
)
def register_account(
    request: RegisterRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> RegistrationAccepted:
    # 202 y el mismo cuerpo para un correo nuevo y para uno registrado (CA-HU-005-03).
    response.headers["Cache-Control"] = "no-store"
    try:
        accounts_service.register(session, request, client_ip=client_ip, user_agent=user_agent)
    except accounts_service.LegalVersionMismatchError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Los términos o la política de privacidad cambiaron. Recargue la página y "
                "revíselos antes de crear la cuenta."
            ),
        ) from None
    return RegistrationAccepted(detail=_REGISTRATION_ACCEPTED)
