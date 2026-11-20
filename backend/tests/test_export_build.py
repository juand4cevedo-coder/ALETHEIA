"""El trabajador publica un paquete completo una sola vez y registra su huella."""

import datetime
import hashlib
import json
import uuid
import zipfile
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session
from tink import streaming_aead

from app.adapters.export_storage import LocalExportSink, export_storage_key
from app.adapters.keys import KeyWrapperError, build_key_wrapper
from app.adapters.stamping import SelloDeTiempo
from app.core.case_keys import new_wrapped_case_key, open_case_key
from app.core.config import Settings
from app.models import CustodyEvent, Evidence, Export, Job
from app.services import evidence_stamp, export_build
from app.services.evidence_upload import ASSOCIATED_PREFIX
from tests.conftest import ZERO_HASH, add_evidence, create_tenant


def test_construccion_publica_zip_y_es_idempotente(
    db: Session, settings: Settings, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    tenant = create_tenant(db, "Paquete")
    wrapper = build_key_wrapper(settings)

    # No hay originales en este caso; la apertura real de llave se prueba por separado.
    class EmptyKeyset:
        def primitive(self, _kind: object) -> object:
            return object()

    monkeypatch.setattr(export_build, "open_case_key", lambda _wrapper, _wrapped: EmptyKeyset())
    db.add(
        CustodyEvent(
            organization_id=tenant.organization_id,
            case_id=tenant.case_id,
            seq=1,
            actor_user_id=tenant.user_id,
            action="case_created",
            details={"test": True},
            occurred_at=datetime.datetime.now(datetime.UTC),
            prev_hash=ZERO_HASH,
        )
    )
    export_id = uuid.uuid7()
    db.add(
        Export(
            id=export_id,
            organization_id=tenant.organization_id,
            case_id=tenant.case_id,
            requested_by=tenant.user_id,
            status="queued",
        )
    )
    db.commit()
    monkeypatch.setattr(
        export_build,
        "new_export_sink",
        lambda _settings, target_id: LocalExportSink(export_storage_key(target_id), root=tmp_path),
    )
    renewals = 0

    def renew() -> None:
        nonlocal renewals
        renewals += 1

    export_build.build(lambda: db, settings, wrapper, export_id, tenant.organization_id, renew)
    row = db.get(Export, export_id)
    assert row is not None
    assert row.status == "ready"
    assert row.storage_key == export_storage_key(export_id)
    assert row.expires_at is not None
    assert renewals >= 2
    path = tmp_path / row.storage_key
    with zipfile.ZipFile(path) as package:
        assert set(package.namelist()) == {
            "custody/events.json",
            "manifest.json",
            "report.pdf",
        }
        assert hashlib.sha256(package.read("manifest.json")).digest() == row.manifest_sha256
    events = db.scalars(
        select(CustodyEvent)
        .where(CustodyEvent.case_id == tenant.case_id)
        .order_by(CustodyEvent.seq)
    ).all()
    assert [event.action for event in events] == ["case_created", "export_ready"]
    expiry_job = db.scalar(select(Job).where(Job.idempotency_key == f"export_expire:{export_id}"))
    assert expiry_job is not None
    assert expiry_job.kind == "export_expire"

    db.commit()
    export_build.build(lambda: db, settings, wrapper, export_id, tenant.organization_id, renew)
    assert (
        len(db.scalars(select(CustodyEvent).where(CustodyEvent.case_id == tenant.case_id)).all())
        == 2
    )


def test_fallo_de_llave_no_publica_paquete(db: Session, settings: Settings) -> None:
    tenant = create_tenant(db, "Llave rota")
    export_id = uuid.uuid7()
    db.add(
        Export(
            id=export_id,
            organization_id=tenant.organization_id,
            case_id=tenant.case_id,
            requested_by=tenant.user_id,
            status="queued",
        )
    )
    db.commit()

    with pytest.raises(KeyWrapperError):
        export_build.build(
            lambda: db,
            settings,
            build_key_wrapper(settings),
            export_id,
            tenant.organization_id,
            lambda: None,
        )

    row = db.get(Export, export_id)
    assert row is not None
    assert row.status == "failed"
    assert row.storage_key is None
    assert row.manifest_sha256 is None


def test_paquete_conserva_original_y_sello_registrados_por_el_trabajador(
    db: Session, settings: Settings, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    wrapper = build_key_wrapper(settings)
    wrapped = new_wrapped_case_key(wrapper)
    tenant = create_tenant(db, "Preservación", key=wrapped)
    content = b"Original para verificar el paquete."
    evidence_id = add_evidence(db, tenant, content)
    evidence = db.get(Evidence, evidence_id)
    assert evidence is not None
    encrypted = tmp_path / ".local" / "evidence" / evidence.storage_key
    encrypted.parent.mkdir(parents=True)
    cipher = open_case_key(wrapper, wrapped).primitive(streaming_aead.StreamingAead)
    associated_data = ASSOCIATED_PREFIX + tenant.case_id.bytes + evidence_id.bytes
    with (
        encrypted.open("wb") as output,
        cipher.new_encrypting_stream(output, associated_data) as stream,
    ):
        stream.write(content)

    export_id = uuid.uuid7()
    db.add(
        Export(
            id=export_id,
            organization_id=tenant.organization_id,
            case_id=tenant.case_id,
            requested_by=tenant.user_id,
            status="queued",
        )
    )
    db.commit()
    token = b"respuesta-de-la-autoridad-de-prueba"
    stamp_time = datetime.datetime(2026, 11, 17, 12, tzinfo=datetime.UTC)

    def stamp_digest(digest: bytes) -> SelloDeTiempo:
        assert digest == hashlib.sha256(content).digest()
        return SelloDeTiempo(token=token, hora=stamp_time)

    monkeypatch.setattr(evidence_stamp, "pedir_sello_de_tiempo", stamp_digest)
    evidence_stamp.stamp(lambda: db, evidence_id, tenant.case_id, tenant.organization_id)
    export_build.build(
        lambda: db, settings, wrapper, export_id, tenant.organization_id, lambda: None
    )

    export = db.get(Export, export_id)
    assert export is not None
    assert export.status == "ready"
    assert export.storage_key is not None
    with zipfile.ZipFile(tmp_path / ".local" / export.storage_key) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        item = manifest["evidences"][0]
        assert archive.read(item["path"]) == content
        assert item["sha256"] == hashlib.sha256(content).hexdigest()
        assert item["tsa_status"] == "stamped"
        assert archive.read(item["tsa_token_path"]) == token
        events = json.loads(archive.read("custody/events.json"))["events"]
        assert events[-1]["action"] == "evidence_stamped"
        assert events[-1]["evidence_id"] == str(evidence_id)
