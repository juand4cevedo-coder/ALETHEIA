"""Portal del cliente: el despacho invita y publica avisos; el cliente los lee (ADR-054)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.cases import get_case_worker
from app.api.deps import get_app_settings, get_client_ip, get_principal, get_session
from app.core.config import Settings
from app.core.tokens import InvalidPortalLinkError
from app.schemas.client_portal import (
    PortalAccessList,
    PortalAccessOut,
    PortalInvite,
    PortalTokenRequest,
    PortalUpdateCreate,
    PortalUpdateList,
    PortalUpdateOut,
    PortalView,
)
from app.services import client_portal as portal
from app.services import rate_limit
from app.services.members import OrganizationNotActiveError
from app.services.sessions import Principal

router = APIRouter(
    prefix="/cases", tags=["portal del cliente"], dependencies=[Depends(get_case_worker)]
)
public_router = APIRouter(prefix="/client-portal", tags=["portal del cliente"])

_NO_STORE = {"Cache-Control": "no-store"}
_NOT_FOUND = "No encontramos lo que busca o no tiene acceso a ello."
_NOT_ALLOWED = "No tiene permiso para esta acción."
_GONE = "El enlace no existe o ya no está vigente."
_INACTIVE = "La organización no está activa."


def _access(view: portal.AccessView) -> PortalAccessOut:
    access = view.access
    return PortalAccessOut(
        id=access.id,
        client_name=access.client_name,
        client_email=access.client_email,
        status=view.status,  # type: ignore[arg-type]
        created_by_name=view.created_by_name,
        created_at=access.created_at,
        expires_at=access.expires_at,
        notice_accepted_at=access.notice_accepted_at,
        last_visit_at=access.last_visit_at,
    )


def _update(view: portal.UpdateView) -> PortalUpdateOut:
    return PortalUpdateOut(
        id=view.update.id,
        author_name=view.author_name,
        body=view.update.body,
        created_at=view.update.created_at,
    )


def _closed() -> HTTPException:
    return HTTPException(
        status.HTTP_409_CONFLICT,
        detail="Un caso archivado conserva lo compartido, pero no admite nada nuevo.",
        headers=_NO_STORE,
    )


@router.get("/{case_id}/portal/accesses", summary="Listar los accesos de clientes de un caso")
def list_portal_accesses(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> PortalAccessList:
    response.headers["Cache-Control"] = "no-store"
    try:
        views = portal.list_accesses(session, principal, case_id)
    except portal.CaseNotFoundError:
        raise HTTPException(404, detail=_NOT_FOUND, headers=_NO_STORE) from None
    except portal.PortalNotAllowedError:
        raise HTTPException(403, detail=_NOT_ALLOWED, headers=_NO_STORE) from None
    return PortalAccessList(items=[_access(view) for view in views])


@router.post(
    "/{case_id}/portal/accesses",
    status_code=status.HTTP_201_CREATED,
    summary="Invitar a un cliente al portal o reenviarle el enlace",
)
def invite_client(
    case_id: uuid.UUID,
    data: PortalInvite,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> PortalAccessOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        view = portal.invite(
            session,
            principal,
            case_id,
            name=data.client_name,
            email=data.client_email,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except portal.CaseNotFoundError:
        raise HTTPException(404, detail=_NOT_FOUND, headers=_NO_STORE) from None
    except portal.PortalNotAllowedError:
        raise HTTPException(403, detail=_NOT_ALLOWED, headers=_NO_STORE) from None
    except portal.ClosedCasePortalError:
        raise _closed() from None
    except OrganizationNotActiveError:
        raise HTTPException(403, detail=_INACTIVE, headers=_NO_STORE) from None
    return _access(view)


@router.delete(
    "/{case_id}/portal/accesses/{access_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Quitarle el acceso a un cliente",
)
def revoke_client_access(
    case_id: uuid.UUID,
    access_id: uuid.UUID,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> Response:
    try:
        portal.revoke(
            session, principal, case_id, access_id, client_ip=client_ip, user_agent=user_agent
        )
    except portal.CaseNotFoundError, portal.AccessNotFoundError:
        raise HTTPException(404, detail=_NOT_FOUND, headers=_NO_STORE) from None
    except portal.PortalNotAllowedError:
        raise HTTPException(403, detail=_NOT_ALLOWED, headers=_NO_STORE) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)


@router.get("/{case_id}/portal/updates", summary="Listar los avisos publicados al cliente")
def list_portal_updates(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> PortalUpdateList:
    response.headers["Cache-Control"] = "no-store"
    try:
        views = portal.list_updates(session, principal, case_id)
    except portal.CaseNotFoundError:
        raise HTTPException(404, detail=_NOT_FOUND, headers=_NO_STORE) from None
    except portal.PortalNotAllowedError:
        raise HTTPException(403, detail=_NOT_ALLOWED, headers=_NO_STORE) from None
    return PortalUpdateList(items=[_update(view) for view in views])


@router.post(
    "/{case_id}/portal/updates",
    status_code=status.HTTP_201_CREATED,
    summary="Publicar un aviso para el cliente",
)
def publish_portal_update(
    case_id: uuid.UUID,
    data: PortalUpdateCreate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> PortalUpdateOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        view = portal.publish_update(
            session, principal, case_id, data.body, client_ip=client_ip, user_agent=user_agent
        )
    except portal.CaseNotFoundError:
        raise HTTPException(404, detail=_NOT_FOUND, headers=_NO_STORE) from None
    except portal.PortalNotAllowedError:
        raise HTTPException(403, detail=_NOT_ALLOWED, headers=_NO_STORE) from None
    except portal.ClosedCasePortalError:
        raise _closed() from None
    except OrganizationNotActiveError:
        raise HTTPException(403, detail=_INACTIVE, headers=_NO_STORE) from None
    return _update(view)


@public_router.post(
    "/view",
    summary="Ver el portal con el enlace del correo",
    responses={
        404: {"description": "El enlace no existe o ya no está vigente."},
        429: {"description": "Demasiados intentos."},
    },
)
def view_portal(
    body: PortalTokenRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> PortalView:
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    rate_limit.hit(session, rate_limit.PORTAL_IP, client_ip)
    session.commit()
    try:
        data = portal.view(session, settings, body.token)
    except InvalidPortalLinkError:
        raise HTTPException(404, detail=_GONE, headers=_NO_STORE) from None
    return PortalView(
        organization_name=data.organization_name,
        client_name=data.client_name,
        notice_accepted=data.notice_accepted,
        case_title=data.case_title,
        case_status=data.case_status,  # type: ignore[arg-type]
        updates=[
            PortalUpdateOut(
                id=item.id,
                author_name=item.author_name,
                body=item.body,
                created_at=item.created_at,
            )
            for item in data.updates
        ],
        expires_at=data.expires_at,
    )


@public_router.post(
    "/accept-notice",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Aceptar el aviso de tratamiento de datos",
    responses={
        404: {"description": "El enlace no existe o ya no está vigente."},
        429: {"description": "Demasiados intentos."},
    },
)
def accept_portal_notice(
    body: PortalTokenRequest,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> Response:
    rate_limit.hit(session, rate_limit.PORTAL_IP, client_ip)
    session.commit()
    try:
        portal.accept_notice(
            session, settings, body.token, client_ip=client_ip, user_agent=user_agent
        )
    except InvalidPortalLinkError:
        raise HTTPException(404, detail=_GONE, headers=_NO_STORE) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)
