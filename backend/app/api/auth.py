"""Cuenta y acceso: registro (API-003), verificación del correo (API-004) y su reenvío."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_app_settings, get_client_ip, get_session
from app.core.config import Settings
from app.core.tokens import InvalidLinkError
from app.schemas.auth import (
    RegisterRequest,
    RegistrationAccepted,
    ResendVerificationRequest,
    VerificationRequested,
    VerifyEmailRequest,
)
from app.services import accounts as accounts_service
from app.services import verification as verification_service

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


_VERIFICATION_REQUESTED = (
    "Si hay una cuenta por verificar con ese correo, le enviamos un enlace nuevo. Revise su "
    "bandeja de entrada y la carpeta de spam."
)


@router.post(
    "/auth/verify-email/resend",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Reenviar el enlace para verificar el correo",
    responses={
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiadas solicitudes."},
    },
)
def resend_verification(
    request: ResendVerificationRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> VerificationRequested:
    # 202 y el mismo cuerpo exista o no la cuenta, igual que el registro.
    response.headers["Cache-Control"] = "no-store"
    accounts_service.resend_verification(session, request.email, client_ip=client_ip)
    return VerificationRequested(detail=_VERIFICATION_REQUESTED)


@router.post(
    "/auth/verify-email",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Verificar el correo con el enlace recibido",
    responses={
        status.HTTP_400_BAD_REQUEST: {"description": "El enlace no es válido o ya venció."},
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiados intentos."},
    },
)
def verify_email(
    request: VerifyEmailRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> None:
    response.headers["Cache-Control"] = "no-store"
    try:
        verification_service.verify_email(
            session, settings, request.token, client_ip=client_ip, user_agent=user_agent
        )
    except InvalidLinkError:
        # Un solo mensaje para todas las causas: quien prueba enlaces no aprende nada.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="El enlace no es válido o ya venció. Pida uno nuevo.",
        ) from None
