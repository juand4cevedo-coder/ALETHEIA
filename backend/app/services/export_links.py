"""Emisión y resolución de enlaces transferibles del paquete de preservación."""

import datetime
from dataclasses import dataclass
from typing import Final

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.export_storage import export_storage_key
from app.core.config import Settings
from app.core.tokens import (
    InvalidExportLinkError,
    export_manifest_matches,
    issue_export_download_link,
    read_export_download_link,
)
from app.db.tenancy import TenantContext, set_tenant
from app.models import Export

LINK_PATH: Final = "/descargar-paquete"


@dataclass(frozen=True, slots=True)
class ReadyExport:
    storage_key: str
    expires_at: datetime.datetime


def link_for_export(
    settings: Settings, export: Export, *, now: datetime.datetime | None = None
) -> str:
    """Entrega el enlace solo si el objeto y la fila siguen listos y vigentes."""
    issued_at = now or datetime.datetime.now(datetime.UTC)
    if (
        export.status != "ready"
        or export.manifest_sha256 is None
        or export.expires_at is None
        or export.expires_at <= issued_at
        or export.storage_key != export_storage_key(export.id)
    ):
        raise InvalidExportLinkError
    token = issue_export_download_link(
        settings.signing_key(),
        export.id,
        export.organization_id,
        export.manifest_sha256,
        export.expires_at,
        now=issued_at,
    )
    return f"{settings.public_url}{LINK_PATH}#t={token}"


def resolve_export_link(
    session: Session,
    settings: Settings,
    token: str,
    *,
    now: datetime.datetime | None = None,
) -> ReadyExport:
    """Consulta la fila bajo RLS usando solo la organización incluida en el token firmado."""
    claims = read_export_download_link(settings.signing_key(), token)
    set_tenant(session, TenantContext(organization_id=claims.organization_id))
    export = session.scalar(
        select(Export).where(
            Export.id == claims.export_id,
            Export.organization_id == claims.organization_id,
        )
    )
    checked_at = now or datetime.datetime.now(datetime.UTC)
    if (
        export is None
        or export.status != "ready"
        or export.manifest_sha256 is None
        or export.expires_at is None
        or export.expires_at <= checked_at
        or export.storage_key != export_storage_key(claims.export_id)
        or not export_manifest_matches(settings.signing_key(), claims, export.manifest_sha256)
    ):
        raise InvalidExportLinkError
    return ReadyExport(export.storage_key, export.expires_at)
