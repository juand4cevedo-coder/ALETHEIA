"""El enlace transferible dura hasta la fecha de la fila y respeta el aislamiento RLS."""

import datetime
import uuid
from pathlib import Path

import pytest
from fastapi import FastAPI
from sqlalchemy.orm import Session

from app.adapters import export_storage
from app.adapters.export_storage import export_storage_key
from app.core.config import Settings
from app.core.tokens import InvalidExportLinkError
from app.models import Export
from app.services.export_links import link_for_export, resolve_export_link
from tests.conftest import NuevoCliente, create_tenant


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


def test_api_entrega_zip_solo_con_enlace_vigente(
    db: Session,
    settings: Settings,
    app: FastAPI,
    dispositivo: NuevoCliente,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tenant = create_tenant(db, "Descarga")
    export_id = uuid.uuid7()
    key = export_storage_key(export_id)
    row = Export(
        id=export_id,
        organization_id=tenant.organization_id,
        case_id=tenant.case_id,
        requested_by=tenant.user_id,
        status="ready",
        manifest_sha256=b"\xaa" * 32,
        storage_key=key,
        expires_at=datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=24),
    )
    db.add(row)
    db.flush()
    monkeypatch.setattr(export_storage, "LOCAL_ROOT", tmp_path)
    path = tmp_path / key
    path.parent.mkdir(parents=True)
    path.write_bytes(b"PK\x03\x04paquete")
    token = link_for_export(settings, row).split("#t=", 1)[1]
    client = dispositivo()

    response = client.post("/api/v1/exports/download", json={"token": token})
    assert response.status_code == 200
    assert response.content == b"PK\x03\x04paquete"
    assert response.headers["Content-Type"] == "application/zip"
    assert response.headers["Cache-Control"] == "no-store"
    assert client.post("/api/v1/exports/download", json={"token": "invalido"}).status_code == 404

    row.status = "expired"
    db.flush()
    assert client.post("/api/v1/exports/download", json={"token": token}).status_code == 404
