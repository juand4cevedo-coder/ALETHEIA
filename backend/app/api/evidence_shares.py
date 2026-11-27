"""Compartir una evidencia con un enlace que vence, y descargarla con él."""

import logging
import uuid
from typing import Annotated
from urllib.parse import quote

import tink
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, Form, Header, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.adapters.keys import KeyWrapper, KeyWrapperError
from app.api.cases import get_case_worker_for_download
from app.api.deps import (
    get_app_settings,
    get_client_ip,
    get_key_wrapper,
    get_principal,
    get_session,
)
from app.core.config import Settings
from app.core.tokens import InvalidShareLinkError
from app.schemas.evidence_shares import (
    SharedEvidenceInfo,
    SharedEvidenceRequest,
    ShareLinkCreate,
    ShareLinkCreated,
    ShareLinkList,
    ShareLinkOut,
)
from app.services import evidence_share as share_service
from app.services import rate_limit
from app.services.cases import CaseNotFoundError
from app.services.evidence_download import DownloadForbidden, EvidenceIntegrityError
from app.services.sessions import Principal

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cases",
    tags=["compartir evidencia"],
    dependencies=[Depends(get_case_worker_for_download)],
)
public_router = APIRouter(prefix="/shared-evidence", tags=["compartir evidencia"])

_NO_STORE = {"Cache-Control": "no-store"}
_NOT_FOUND = "No encontramos lo que busca o no tiene acceso a ello."
_NOT_ALLOWED = "Este rol no puede compartir originales."
_GONE = "El enlace no existe o ya no está vigente."


def _out(view: share_service.LinkView) -> ShareLinkOut:
    link = view.link
    return ShareLinkOut(
        id=link.id,
        label=link.label,
        created_by_name=view.created_by_name,
        created_at=link.created_at,
        expires_at=link.expires_at,
        revoked_at=link.revoked_at,
        status=view.status,
        download_count=link.download_count,
        last_downloaded_at=link.last_downloaded_at,
    )


@router.get(
    "/{case_id}/evidences/{evidence_id}/share-links",
    summary="Listar los enlaces de una evidencia",
)
def list_share_links(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> ShareLinkList:
    response.headers["Cache-Control"] = "no-store"
    try:
        views = share_service.list_links(session, principal, case_id, evidence_id)
    except CaseNotFoundError:
        raise HTTPException(404, detail=_NOT_FOUND, headers=_NO_STORE) from None
    except DownloadForbidden:
        raise HTTPException(403, detail=_NOT_ALLOWED, headers=_NO_STORE) from None
    return ShareLinkList(items=[_out(view) for view in views])


@router.post(
    "/{case_id}/evidences/{evidence_id}/share-links",
    status_code=status.HTTP_201_CREATED,
    summary="Crear un enlace para compartir una evidencia",
)
def create_share_link(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    data: ShareLinkCreate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ShareLinkCreated:
    response.headers["Cache-Control"] = "no-store"
    try:
        view, url = share_service.create_link(
            session,
            settings,
            principal,
            case_id,
            evidence_id,
            hours=data.expires_in_hours,
            label=data.label,
        )
    except CaseNotFoundError:
        raise HTTPException(404, detail=_NOT_FOUND, headers=_NO_STORE) from None
    except DownloadForbidden:
        raise HTTPException(403, detail=_NOT_ALLOWED, headers=_NO_STORE) from None
    return ShareLinkCreated(link=_out(view), url=url)


@router.delete(
    "/{case_id}/evidences/{evidence_id}/share-links/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revocar un enlace de evidencia",
)
def revoke_share_link(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    link_id: uuid.UUID,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> Response:
    try:
        share_service.revoke_link(session, principal, case_id, evidence_id, link_id)
    except CaseNotFoundError, share_service.LinkNotFoundError:
        raise HTTPException(404, detail=_NOT_FOUND, headers=_NO_STORE) from None
    except DownloadForbidden:
        raise HTTPException(403, detail=_NOT_ALLOWED, headers=_NO_STORE) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)


@public_router.post(
    "/inspect",
    summary="Comprobar un enlace de evidencia antes de descargar",
)
def inspect_shared_evidence(
    body: SharedEvidenceRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> SharedEvidenceInfo:
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex"
    rate_limit.hit(session, rate_limit.SHARE_LINK_IP, client_ip)
    session.commit()
    try:
        info = share_service.inspect(session, settings, body.token)
    except InvalidShareLinkError:
        raise HTTPException(404, detail=_GONE, headers=_NO_STORE) from None
    return SharedEvidenceInfo(
        filename=info.filename,
        size_bytes=info.size_bytes,
        sha256=info.sha256.hex(),
        expires_at=info.expires_at,
    )


@public_router.post(
    "/download",
    response_class=StreamingResponse,
    summary="Descargar una evidencia con un enlace vigente",
    responses={
        200: {
            "description": "Archivo original verificado; queda en la cadena de custodia.",
            "content": {
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}}
            },
        },
        404: {"description": "El enlace no existe o ya no está vigente."},
        429: {"description": "Demasiados intentos de descarga."},
        503: {"description": "No se pudo verificar o leer el archivo conservado."},
    },
)
def download_shared_evidence(
    token: Annotated[str, Form(min_length=1, max_length=4096)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    wrapper: Annotated[KeyWrapper, Depends(get_key_wrapper)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> StreamingResponse:
    # El límite cuenta enlaces válidos e inválidos por igual y se confirma antes de tocar RLS.
    rate_limit.hit(session, rate_limit.SHARE_LINK_IP, client_ip)
    session.commit()
    try:
        download = share_service.prepare_shared_download(
            session, settings, wrapper, token, client_ip=client_ip, user_agent=user_agent
        )
    except InvalidShareLinkError:
        raise HTTPException(404, detail=_GONE, headers=_NO_STORE) from None
    except (
        KeyWrapperError,
        BotoCoreError,
        ClientError,
        OSError,
        ValueError,
        tink.TinkError,
        EvidenceIntegrityError,
    ):
        logger.exception("No se pudo verificar una evidencia compartida antes de descargarla")
        raise HTTPException(
            503, detail="No se pudo verificar el archivo conservado.", headers=_NO_STORE
        ) from None
    return StreamingResponse(
        download.chunks(),
        media_type="application/octet-stream",
        headers={
            "Cache-Control": "no-store",
            "Content-Length": str(download.size_bytes),
            "Content-Disposition": (
                f"attachment; filename*=UTF-8''{quote(download.filename, safe='')}"
            ),
            "X-Content-Type-Options": "nosniff",
            "X-Robots-Tag": "noindex",
        },
    )
