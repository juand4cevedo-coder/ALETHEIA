"""Segundo factor de la cuenta: activarlo, desactivarlo y renovar los códigos de respaldo."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_app_settings, get_client_ip, get_principal, get_session
from app.core.config import Settings
from app.models import User
from app.schemas.two_factor import (
    TwoFactorCode,
    TwoFactorEnabled,
    TwoFactorSetup,
    TwoFactorStatus,
)
from app.services import two_factor as two_factor_service
from app.services.sessions import Principal

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
    principal: Annotated[Principal, Depends(get_principal)],
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
    principal: Annotated[Principal, Depends(get_principal)],
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
    two_factor_service.InvalidTwoFactorCodeError,
    two_factor_service.TwoFactorAlreadyEnabledError,
    two_factor_service.TwoFactorNotEnabledError,
    two_factor_service.TwoFactorSetupNotStartedError,
)


@router.post("/enable", summary="Confirmar la activación con el primer código")
def two_factor_enable(
    request: TwoFactorCode,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
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
    principal: Annotated[Principal, Depends(get_principal)],
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
    principal: Annotated[Principal, Depends(get_principal)],
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
