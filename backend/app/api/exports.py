"""Descarga transferible de paquetes de preservación ya construidos."""

import logging
from collections.abc import Iterator
from typing import Annotated

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.adapters.export_storage import READ_CHUNK_BYTES, open_export
from app.api.deps import get_app_settings, get_client_ip, get_session
from app.core.config import Settings
from app.core.tokens import InvalidExportLinkError
from app.services import rate_limit
from app.services.export_links import resolve_export_link

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/exports", tags=["exportaciones"])


class ExportDownloadRequest(BaseModel):
    token: str = Field(min_length=1, max_length=4096)


@router.post(
    "/download",
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
    body: ExportDownloadRequest,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> StreamingResponse:
    # El límite cuenta enlaces válidos e inválidos por igual; se confirma antes de tocar RLS.
    rate_limit.hit(session, rate_limit.EXPORT_LINK_IP, client_ip)
    session.commit()
    try:
        ready = resolve_export_link(session, settings, body.token)
    except InvalidExportLinkError:
        raise HTTPException(
            404, detail="El enlace no existe o ya no está vigente.",
            headers={"Cache-Control": "no-store"},
        ) from None
    session.commit()

    # Abre antes de enviar cabeceras para distinguir objeto ausente de un ZIP válido.
    source_context = open_export(settings, ready.storage_key)
    try:
        source = source_context.__enter__()
    except (OSError, ValueError, KeyError, BotoCoreError, ClientError):
        logger.exception("No se pudo abrir el paquete de exportación")
        raise HTTPException(
            503, detail="No se pudo leer el paquete conservado.",
            headers={"Cache-Control": "no-store"},
        ) from None
    try:
        first_chunk = source.read(READ_CHUNK_BYTES)
        if not first_chunk:
            raise OSError("Paquete vacío")
    except (OSError, ValueError, KeyError, BotoCoreError, ClientError):
        source_context.__exit__(None, None, None)
        logger.exception("No se pudo abrir el paquete de exportación")
        raise HTTPException(
            503, detail="No se pudo leer el paquete conservado.",
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
