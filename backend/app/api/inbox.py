"""Avisos dentro de la aplicación: la campana del encabezado y su panel (ADR-063)."""

import uuid
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.schemas.inbox import InboxOut, NotificationOut
from app.services import inbox as inbox_service
from app.services.sessions import Principal

router = APIRouter(prefix="/notifications", tags=["avisos"])

NOT_FOUND = "Ese aviso no existe o ya no está disponible."

_Kind = Literal["task_assigned", "case_member_added", "client_message", "member_joined"]


@router.get("", summary="Avisos recientes y cuántos faltan por leer")
def list_notifications(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> InboxOut:
    response.headers["Cache-Control"] = "no-store"
    if principal.organization_id is None:
        return InboxOut(items=[], unread=0)
    found = inbox_service.inbox(session, principal)
    return InboxOut(
        items=[
            NotificationOut(
                id=item.id,
                kind=cast(_Kind, item.kind),
                title=item.title,
                body=item.body,
                link=item.link,
                read=item.read_at is not None,
                created_at=item.created_at,
            )
            for item in found.items
        ],
        unread=found.unread,
    )


@router.post(
    "/{notification_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Marcar un aviso como leído",
    responses={status.HTTP_404_NOT_FOUND: {"description": NOT_FOUND}},
)
def read_notification(
    notification_id: uuid.UUID,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> None:
    try:
        inbox_service.mark_read(session, principal, notification_id)
    except inbox_service.NotificationNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND) from None


@router.post(
    "/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Marcar todos los avisos como leídos",
)
def read_all_notifications(
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> None:
    if principal.organization_id is not None:
        inbox_service.mark_all_read(session, principal)
