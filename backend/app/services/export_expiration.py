"""Invalida paquetes vencidos y elimina el objeto fuera de la transacción."""

import datetime
import uuid
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.export_storage import delete_export, export_storage_key
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import Export
from app.services.jobs import PermanentJobError


class ExportNotDueError(Exception):
    """La tarea llegó antes del vencimiento; la cola debe reintentarla."""


def expire(
    open_session: Callable[[], Session],
    settings: Settings,
    export_id: uuid.UUID,
    organization_id: uuid.UUID,
    *,
    now: datetime.datetime | None = None,
) -> None:
    checked_at = now or datetime.datetime.now(datetime.UTC)
    key: str | None = None
    with open_session() as session, session.begin():
        set_tenant(session, TenantContext(organization_id=organization_id))
        export = session.scalar(
            select(Export)
            .where(Export.id == export_id, Export.organization_id == organization_id)
            .with_for_update()
        )
        if export is None or export.status not in {"ready", "expired"}:
            return
        if export.expires_at is None or export.storage_key != export_storage_key(export_id):
            raise PermanentJobError("La exportación tiene un objeto inválido.")
        if export.expires_at > checked_at:
            raise ExportNotDueError
        key = export.storage_key
        export.status = "expired"
    # Si S3 falla, el reintento vuelve a borrar aunque el estado ya sea expired.
    if key is not None:
        delete_export(settings, key)
