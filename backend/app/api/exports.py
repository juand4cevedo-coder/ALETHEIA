"""Descarga transferible de paquetes de preservación ya construidos."""

import datetime
import logging
import uuid
from collections.abc import Iterator
from typing import Annotated

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, Form, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.adapters.export_storage import READ_CHUNK_BYTES, open_export
from app.api.cases import get_case_worker_for_download
from app.api.deps import (
    get_app_settings,
    get_client_ip,
    get_principal_allowing_outdated_legal,
    get_session,
)
from app.core.config import Settings
from app.core.tokens import InvalidExportLinkError
from app.services import rate_limit
from app.services.export_links import resolve_export_link
from app.services.export_requests import (
    CaseUnavailable,
    ExportForbidden,
    ExportNotFound,
    get_export,
    list_exports,
    request_export,
)
from app.services.sessions import Principal

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/exports", tags=["exportaciones"])
case_router = APIRouter(
    prefix="/cases", tags=["exportaciones"], dependencies=[Depends(get_case_worker_for_download)]
)


class ExportInspectRequest(BaseModel):
    token: str = Field(min_length=1, max_length=4096)


class ExportInspectResponse(BaseModel):
    expires_at: datetime.datetime


class ExportResponse(BaseModel):
    id: uuid.UUID
    status: str
    created_at: datetime.datetime
    expires_at: datetime.datetime | None
    download_url: str | None


class ExportListItemOut(ExportResponse):
    requested_by_name: str
    manifest_sha256: str | None = Field(
        description="Huella SHA-256 del manifiesto del paquete, si ya está listo."
    )


class ExportList(BaseModel):
    items: list[ExportListItemOut]


@case_router.post(
    "/{case_id}/exports",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ExportResponse,
    summary="Solicitar un paquete de preservación",
)
def create_case_export(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal_allowing_outdated_legal)],
    session: Annotated[Session, Depends(get_session)],
) -> ExportResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        rate_limit.hit(session, rate_limit.EXPORT_ACCOUNT, str(principal.user_id))
        session.commit()
    except rate_limit.RateLimitExceededError as exc:
        raise HTTPException(
            429,
            detail="Demasiadas exportaciones; reintente más tarde.",
            headers={"Cache-Control": "no-store", "Retry-After": str(exc.retry_after)},
        ) from None
    try:
        view = request_export(session, principal, case_id)
    except ExportNotFound:
        raise HTTPException(404, detail="El caso no existe para esta persona.") from None
    except ExportForbidden:
        raise HTTPException(403, detail="No puede exportar este caso.") from None
    except CaseUnavailable:
        raise HTTPException(409, detail="El caso no permite exportación.") from None
    return ExportResponse.model_validate(view, from_attributes=True)


@case_router.get(
    "/{case_id}/exports",
    response_model=ExportList,
    summary="Listar los paquetes de preservación de un caso",
)
def list_case_exports(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal_allowing_outdated_legal)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ExportList:
    response.headers["Cache-Control"] = "no-store"
    try:
        items = list_exports(session, settings, principal, case_id)
    except ExportNotFound:
        raise HTTPException(404, detail="El caso no existe para esta persona.") from None
    except ExportForbidden:
        raise HTTPException(403, detail="No puede exportar este caso.") from None
    except CaseUnavailable:
        raise HTTPException(409, detail="El caso no permite exportación.") from None
    return ExportList(
        items=[
            ExportListItemOut(
                id=item.id,
                status=item.status,
                created_at=item.created_at,
                expires_at=item.expires_at,
                download_url=item.download_url,
                requested_by_name=item.requested_by_name,
                manifest_sha256=item.manifest_sha256.hex() if item.manifest_sha256 else None,
            )
            for item in items
        ]
    )


@case_router.get(
    "/{case_id}/exports/{export_id}",
    response_model=ExportResponse,
    summary="Consultar una exportación y su enlace vigente",
)
def read_case_export(
    case_id: uuid.UUID,
    export_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal_allowing_outdated_legal)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> ExportResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        view = get_export(session, settings, principal, case_id, export_id)
    except ExportNotFound:
        raise HTTPException(404, detail="La exportación no existe para esta persona.") from None
    except ExportForbidden:
        raise HTTPException(403, detail="No puede exportar este caso.") from None
    except CaseUnavailable:
        raise HTTPException(409, detail="El caso no permite exportación.") from None
    return ExportResponse.model_validate(view, from_attributes=True)


@router.post(
    "/inspect",
    response_model=ExportInspectResponse,
    summary="Comprobar si un enlace de paquete sigue vigente",
)
def inspect_export(
    body: ExportInspectRequest,
    response: Response,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> ExportInspectResponse:
    response.headers["Cache-Control"] = "no-store"
    rate_limit.hit(session, rate_limit.EXPORT_LINK_IP, client_ip)
    session.commit()
    try:
        ready = resolve_export_link(session, settings, body.token)
    except InvalidExportLinkError:
        raise HTTPException(
            404,
            detail="El enlace no existe o ya no está vigente.",
            headers={"Cache-Control": "no-store"},
        ) from None
    return ExportInspectResponse(expires_at=ready.expires_at)


@router.post(
    "/download",
    response_class=StreamingResponse,
    summary="Descargar un paquete mediante un enlace vigente",
    responses={
        200: {
            "description": "Paquete ZIP conservado.",
            "content": {"application/zip": {"schema": {"type": "string", "format": "binary"}}},
        },
        404: {"description": "El enlace no existe o ya no está vigente."},
        429: {"description": "Demasiados intentos de descarga."},
        503: {"description": "No se pudo leer el paquete conservado."},
    },
)
def download_export(
    token: Annotated[str, Form(min_length=1, max_length=4096)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> StreamingResponse:
    # El límite cuenta enlaces válidos e inválidos por igual; se confirma antes de tocar RLS.
    rate_limit.hit(session, rate_limit.EXPORT_LINK_IP, client_ip)
    session.commit()
    try:
        ready = resolve_export_link(session, settings, token)
    except InvalidExportLinkError:
        raise HTTPException(
            404,
            detail="El enlace no existe o ya no está vigente.",
            headers={"Cache-Control": "no-store"},
        ) from None
    session.commit()

    # Abre antes de enviar cabeceras para distinguir objeto ausente de un ZIP válido.
    source_context = open_export(settings, ready.storage_key)
    try:
        source = source_context.__enter__()
    except OSError, ValueError, KeyError, BotoCoreError, ClientError:
        logger.exception("No se pudo abrir el paquete de exportación")
        raise HTTPException(
            503,
            detail="No se pudo leer el paquete conservado.",
            headers={"Cache-Control": "no-store"},
        ) from None
    try:
        first_chunk = source.read(READ_CHUNK_BYTES)
        if not first_chunk:
            raise OSError("Paquete vacío")
    except OSError, ValueError, KeyError, BotoCoreError, ClientError:
        source_context.__exit__(None, None, None)
        logger.exception("No se pudo abrir el paquete de exportación")
        raise HTTPException(
            503,
            detail="No se pudo leer el paquete conservado.",
            headers={"Cache-Control": "no-store"},
        ) from None

    def chunks() -> Iterator[bytes]:
        try:
            yield first_chunk
            while chunk := source.read(READ_CHUNK_BYTES):
                yield chunk
        finally:
            source_context.__exit__(None, None, None)

    return StreamingResponse(
        chunks(),
        media_type="application/zip",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="paquete-aletheia.zip"',
            "X-Content-Type-Options": "nosniff",
        },
    )
