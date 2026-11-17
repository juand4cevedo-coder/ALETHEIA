"""El vencimiento invalida el enlace y repite la eliminación si el objeto persiste."""

import datetime
import uuid

import pytest
from sqlalchemy.orm import Session

from app.adapters.export_storage import export_storage_key
from app.core.config import Settings
from app.models import Export
from app.services import export_expiration
from tests.conftest import create_tenant


def test_vencimiento_borra_objeto_y_es_reintentable(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant = create_tenant(db, "Vencimiento")
    export_id = uuid.uuid7()
    key = export_storage_key(export_id)
    db.add(
        Export(
            id=export_id,
            organization_id=tenant.organization_id,
            case_id=tenant.case_id,
            requested_by=tenant.user_id,
            status="ready",
            storage_key=key,
            manifest_sha256=b"\xaa" * 32,
            expires_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=1),
        )
    )
    db.commit()
    deleted: list[str] = []

    def delete_once_failed(_settings: Settings, target: str) -> None:
        deleted.append(target)
        if len(deleted) == 1:
            raise OSError("S3 no respondió")

    monkeypatch.setattr(export_expiration, "delete_export", delete_once_failed)

    with pytest.raises(OSError, match="S3 no respondió"):
        export_expiration.expire(lambda: db, settings, export_id, tenant.organization_id)
    export_expiration.expire(lambda: db, settings, export_id, tenant.organization_id)
    assert deleted == [key, key]
    row = db.get(Export, export_id)
    assert row is not None
    assert row.status == "expired"


def test_paquete_vigente_no_se_borra(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant = create_tenant(db, "Vigente")
    export_id = uuid.uuid7()
    db.add(
        Export(
            id=export_id,
            organization_id=tenant.organization_id,
            case_id=tenant.case_id,
            requested_by=tenant.user_id,
            status="ready",
            storage_key=export_storage_key(export_id),
            manifest_sha256=b"\xaa" * 32,
            expires_at=datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=24),
        )
    )
    db.commit()
    monkeypatch.setattr(
        export_expiration,
        "delete_export",
        lambda _settings, _key: pytest.fail("No debe borrar el objeto vigente"),
    )
    with pytest.raises(export_expiration.ExportNotDueError):
        export_expiration.expire(lambda: db, settings, export_id, tenant.organization_id)
