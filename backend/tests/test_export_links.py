"""El enlace transferible dura hasta la fecha de la fila y respeta el aislamiento RLS."""

import datetime
import uuid

import pytest
from sqlalchemy.orm import Session

from app.adapters.export_storage import export_storage_key
from app.core.config import Settings
from app.core.tokens import InvalidExportLinkError
from app.models import Export
from app.services.export_links import link_for_export, resolve_export_link
from tests.conftest import create_tenant


def test_enlace_resuelve_paquete_vigente_y_deja_de_servir_al_expirar(
    db: Session, settings: Settings
) -> None:
    tenant = create_tenant(db, "Exportación")
    export_id = uuid.uuid7()
    expires_at = datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=24)
    row = Export(
        id=export_id,
        organization_id=tenant.organization_id,
        case_id=tenant.case_id,
        requested_by=tenant.user_id,
        status="ready",
        manifest_sha256=b"\xaa" * 32,
        storage_key=export_storage_key(export_id),
        expires_at=expires_at,
    )
    db.add(row)
    db.flush()

    link = link_for_export(settings, row)
    assert link.startswith(f"{settings.public_url}/descargar-paquete#t=")
    token = link.split("#t=", 1)[1]
    assert resolve_export_link(db, settings, token).storage_key == row.storage_key

    row.expires_at = datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=1)
    db.flush()
    with pytest.raises(InvalidExportLinkError):
        resolve_export_link(db, settings, token)


def test_enlace_no_sirve_si_cambia_el_manifiesto_o_no_hay_objeto(
    db: Session, settings: Settings
) -> None:
    tenant = create_tenant(db, "Enlace")
    export_id = uuid.uuid7()
    row = Export(
        id=export_id,
        organization_id=tenant.organization_id,
        case_id=tenant.case_id,
        requested_by=tenant.user_id,
        status="ready",
        manifest_sha256=b"\xaa" * 32,
        storage_key=export_storage_key(export_id),
        expires_at=datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=24),
    )
    db.add(row)
    db.flush()
    token = link_for_export(settings, row).split("#t=", 1)[1]

    row.manifest_sha256 = b"\xbb" * 32
    db.flush()
    with pytest.raises(InvalidExportLinkError):
        resolve_export_link(db, settings, token)
    row.manifest_sha256 = b"\xaa" * 32
    row.storage_key = "exports/otro.zip"
    db.flush()
    with pytest.raises(InvalidExportLinkError):
        resolve_export_link(db, settings, token)
