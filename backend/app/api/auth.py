"""Cuenta y acceso: registro (API-003), verificación del correo (API-004) y su reenvío, e
ingreso con correo y contraseña (API-005)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.adapters.email import REPLY_TO
from app.api.cookies import set_session_cookies
from app.api.deps import SESSION_CHALLENGE, get_app_settings, get_client_ip, get_session
from app.core.config import Settings
from app.core.tokens import InvalidLinkError
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegistrationAccepted,
    ResendVerificationRequest,
    VerificationRequested,
    VerifyEmailRequest,
)
from app.services import accounts as accounts_service
from app.services import sessions as sessions_service
from app.services import verification as verification_service
from app.services.legal import LegalVersionMismatchError

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
    except LegalVersionMismatchError:
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


# MSG-002. El mismo texto exista o no el correo, tenga o no contraseña (RN-026).
_INVALID_CREDENTIALS = "El correo o la contraseña no coinciden. Revise los datos."
_ACCOUNT_BLOCKED = f"Esta cuenta está bloqueada. Escríbanos a {REPLY_TO} para revisar su caso."


@router.post(
    "/auth/login",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Ingresar con correo y contraseña",
    responses={
        status.HTTP_204_NO_CONTENT: {
            "description": "Sesión abierta: llegan las cookies de acceso y de renovación."
        },
        status.HTTP_401_UNAUTHORIZED: {"description": "El correo o la contraseña no coinciden."},
        status.HTTP_403_FORBIDDEN: {"description": "La cuenta está bloqueada."},
        status.HTTP_429_TOO_MANY_REQUESTS: {
            "description": "Demasiados intentos fallidos para la cuenta o desde la IP."
        },
    },
)
def sign_in(
    request: LoginRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> None:
    response.headers["Cache-Control"] = "no-store"
    try:
        issued = sessions_service.sign_in(
            session,
            settings,
            request.email,
            request.password,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except sessions_service.InvalidCredentialsError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_CREDENTIALS,
            headers={"WWW-Authenticate": SESSION_CHALLENGE, "Cache-Control": "no-store"},
        ) from None
    except sessions_service.AccountBlockedError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail=_ACCOUNT_BLOCKED,
            headers={"Cache-Control": "no-store"},
        ) from None
    set_session_cookies(response, issued)
