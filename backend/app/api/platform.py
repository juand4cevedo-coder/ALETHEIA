"""Operaciones de plataforma, separadas de los datos de cada despacho."""

import datetime
import uuid
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_principal, get_session
from app.models import AuditLog, User
from app.repositories.sessions import revoke_user_sessions
from app.schemas.platform import PlatformUser, PlatformUserPage, UserStatusChange
from app.services.sessions import Principal

router = APIRouter(prefix="/platform", tags=["plataforma"])


def get_platform_admin(
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> Principal:
    """Comprueba el atributo en la base en cada petición; no confía en la interfaz ni el token."""
    is_admin = session.scalar(select(User.is_platform_admin).where(User.id == principal.user_id))
    if is_admin is not True:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta no administra la plataforma.",
            headers={"Cache-Control": "no-store"},
        )
    return principal


def _public_user(user: User) -> PlatformUser:
    return PlatformUser(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        status=cast(Literal["active", "blocked"], user.status),
        email_verified=user.email_verified_at is not None,
        platform_admin=user.is_platform_admin,
        created_at=user.created_at,
    )


@router.get("/users", summary="Cuentas de la plataforma")
def list_platform_users(
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    cursor: uuid.UUID | None = None,
) -> PlatformUserPage:
    del principal
    response.headers["Cache-Control"] = "no-store"
    query = select(User).order_by(User.id.desc()).limit(51)
    if cursor is not None:
        query = query.where(User.id < cursor)
    users = list(session.scalars(query))
    return PlatformUserPage(
        items=[_public_user(user) for user in users[:50]],
        next_cursor=users[49].id if len(users) > 50 else None,
    )


@router.patch("/users/{user_id}/status", summary="Bloquear o desbloquear una cuenta")
def change_platform_user_status(
    user_id: uuid.UUID,
    change: UserStatusChange,
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> PlatformUser:
    response.headers["Cache-Control"] = "no-store"
    user = session.scalar(select(User).where(User.id == user_id).with_for_update())
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="La cuenta no existe.")
    if user.id == principal.user_id or user.is_platform_admin:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="La cuenta administradora de plataforma no se bloquea desde esta operación.",
        )
    if user.status != change.status:
        user.status = change.status
        now = datetime.datetime.now(datetime.UTC)
        if change.status == "blocked":
            revoke_user_sessions(session, user.id, now)
        session.add(
            AuditLog(
                organization_id=None,
                actor_user_id=principal.user_id,
                action="account_blocked" if change.status == "blocked" else "account_unblocked",
                target_id=user.id,
                ip=client_ip if client_ip != "desconocida" else None,
                user_agent=None,
                created_at=now,
            )
        )
        session.commit()
    return _public_user(user)
