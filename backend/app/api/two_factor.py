"""Segundo factor de la cuenta: activarlo, desactivarlo y renovar los códigos de respaldo."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_app_settings, get_client_ip, get_principal_bare, get_session
from app.core.config import Settings
from app.core.tokens import InvalidLinkError
from app.models import User
from app.schemas.two_factor import (
    RecoveryCancel,
    RecoveryComplete,
    RecoveryConfirm,
    RecoveryRequest,
    RecoveryRequested,
    RecoveryStarted,
    TwoFactorCode,
    TwoFactorEnabled,
    TwoFactorSetup,
    TwoFactorStatus,
)
from app.services import two_factor as two_factor_service
from app.services import two_factor_recovery as recovery_service
from app.services.organization_emails import colombian_datetime
from app.services.sessions import InvalidCredentialsError, Principal

router = APIRouter(prefix="/account/two-factor", tags=["segundo factor"])

_INVALID_CODE = "El código no es válido. Revise la aplicación e inténtelo de nuevo."


def _user(session: Session, principal: Principal) -> User:
    user = session.get(User, principal.user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED)
    return user


@router.get("", summary="Estado del segundo factor de la cuenta")
def two_factor_status(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal_bare)],
    session: Annotated[Session, Depends(get_session)],
) -> TwoFactorStatus:
    response.headers["Cache-Control"] = "no-store"
    current = two_factor_service.status(session, principal.user_id)
    return TwoFactorStatus(
        enabled=current.enabled, recovery_codes_remaining=current.recovery_codes_remaining
    )


@router.post("/setup", summary="Empezar la activación: entrega el secreto una vez")
def two_factor_setup(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal_bare)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> TwoFactorSetup:
    response.headers["Cache-Control"] = "no-store"
    try:
        setup = two_factor_service.begin_setup(session, settings, _user(session, principal))
    except two_factor_service.TwoFactorAlreadyEnabledError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="El segundo factor ya está activo."
        ) from None
    return TwoFactorSetup(secret=setup.secret, uri=setup.uri)


def _reject(error: Exception) -> HTTPException:
    if isinstance(error, two_factor_service.TwoFactorRequiredByPolicyError):
        return HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Su despacho exige la verificación en dos pasos: no se puede desactivar.",
        )
    if isinstance(error, two_factor_service.InvalidTwoFactorCodeError):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=_INVALID_CODE)
    if isinstance(error, two_factor_service.TwoFactorAlreadyEnabledError):
        return HTTPException(status.HTTP_409_CONFLICT, detail="El segundo factor ya está activo.")
    if isinstance(error, two_factor_service.TwoFactorSetupNotStartedError):
        return HTTPException(
            status.HTTP_409_CONFLICT, detail="Primero pida el secreto para empezar la activación."
        )
    return HTTPException(status.HTTP_409_CONFLICT, detail="El segundo factor no está activo.")


_HANDLED = (
    two_factor_service.TwoFactorRequiredByPolicyError,
    two_factor_service.InvalidTwoFactorCodeError,
    two_factor_service.TwoFactorAlreadyEnabledError,
    two_factor_service.TwoFactorNotEnabledError,
    two_factor_service.TwoFactorSetupNotStartedError,
)


@router.post("/enable", summary="Confirmar la activación con el primer código")
def two_factor_enable(
    request: TwoFactorCode,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal_bare)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> TwoFactorEnabled:
    response.headers["Cache-Control"] = "no-store"
    try:
        codes = two_factor_service.enable(
            session,
            settings,
            _user(session, principal),
            request.code,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except _HANDLED as error:
        raise _reject(error) from None
    return TwoFactorEnabled(recovery_codes=codes)


@router.post(
    "/disable",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desactivar el segundo factor con un código vigente",
)
def two_factor_disable(
    request: TwoFactorCode,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal_bare)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> None:
    response.headers["Cache-Control"] = "no-store"
    try:
        two_factor_service.disable(
            session,
            settings,
            _user(session, principal),
            request.code,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except _HANDLED as error:
        raise _reject(error) from None


@router.post("/recovery-codes", summary="Generar códigos de respaldo nuevos")
def two_factor_recovery_codes(
    request: TwoFactorCode,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal_bare)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> TwoFactorEnabled:
    response.headers["Cache-Control"] = "no-store"
    try:
        codes = two_factor_service.regenerate_codes(
            session,
            settings,
            _user(session, principal),
            request.code,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except _HANDLED as error:
        raise _reject(error) from None
    return TwoFactorEnabled(recovery_codes=codes)


# Recuperar el segundo factor sin teléfono ni códigos (ADR-053). Son rutas públicas: la persona
# no tiene sesión. Cada una responde sin revelar si la cuenta existe o tiene segundo factor.
recovery_router = APIRouter(prefix="/auth/two-factor-recovery", tags=["segundo factor"])

_RECOVERY_SENT = (
    "Si la cuenta existe y tiene el segundo factor activo, recibirá un correo con los pasos."
)
_BAD_LINK = "El enlace no es válido o ya venció."
_BAD_CREDENTIALS = "Correo o contraseña incorrectos."
_NO_STORE = {"Cache-Control": "no-store"}


@recovery_router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Pedir recuperar el segundo factor por correo",
    responses={status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiadas solicitudes."}},
)
def request_recovery(
    body: RecoveryRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> RecoveryRequested:
    response.headers["Cache-Control"] = "no-store"
    recovery_service.request(session, body.email, client_ip=client_ip)
    return RecoveryRequested(detail=_RECOVERY_SENT)


@recovery_router.post(
    "/confirm",
    summary="Confirmar el pedido con el enlace del correo y la contraseña",
    responses={
        status.HTTP_400_BAD_REQUEST: {"description": "El enlace no es válido o ya venció."},
        status.HTTP_401_UNAUTHORIZED: {"description": "La contraseña no coincide."},
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiados intentos."},
    },
)
def confirm_recovery(
    body: RecoveryConfirm,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> RecoveryStarted:
    response.headers["Cache-Control"] = "no-store"
    try:
        started = recovery_service.confirm(
            session,
            settings,
            body.token,
            body.password,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except InvalidLinkError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=_BAD_LINK, headers=_NO_STORE
        ) from None
    except InvalidCredentialsError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail=_BAD_CREDENTIALS, headers=_NO_STORE
        ) from None
    return RecoveryStarted(available_at=started.available_at)


@recovery_router.post(
    "/cancel",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancelar la recuperación con el enlace del aviso",
    responses={
        status.HTTP_400_BAD_REQUEST: {"description": "El enlace no es válido o ya no sirve."},
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiados intentos."},
    },
)
def cancel_recovery(
    body: RecoveryCancel,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> None:
    response.headers["Cache-Control"] = "no-store"
    try:
        recovery_service.cancel(
            session, settings, body.token, client_ip=client_ip, user_agent=user_agent
        )
    except InvalidLinkError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=_BAD_LINK, headers=_NO_STORE
        ) from None


@recovery_router.post(
    "/complete",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Terminar la recuperación pasada la espera de seguridad",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"description": "Correo o contraseña incorrectos."},
        status.HTTP_404_NOT_FOUND: {"description": "No hay una recuperación abierta."},
        status.HTTP_409_CONFLICT: {"description": "La espera de seguridad no ha terminado."},
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiados intentos."},
    },
)
def complete_recovery(
    body: RecoveryComplete,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> None:
    response.headers["Cache-Control"] = "no-store"
    try:
        recovery_service.complete(
            session, body.email, body.password, client_ip=client_ip, user_agent=user_agent
        )
    except InvalidCredentialsError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail=_BAD_CREDENTIALS, headers=_NO_STORE
        ) from None
    except recovery_service.NoRecoveryError:
        # La contraseña ya se comprobó: a esta persona sí se le puede decir que no hay pedido.
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="No hay una recuperación abierta para esta cuenta. Pídala de nuevo.",
            headers=_NO_STORE,
        ) from None
    except recovery_service.RecoveryNotReadyError as waiting:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "La espera de seguridad termina el "
                f"{colombian_datetime(waiting.available_at)} (hora de Colombia)."
            ),
            headers=_NO_STORE,
        ) from None
