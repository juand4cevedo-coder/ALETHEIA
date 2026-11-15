"""HU-018: huella, autorización, topes y limpieza de una carga fallida."""

import datetime
import hashlib
import io
import uuid
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx2 import Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from tink import streaming_aead

from app.adapters.evidence_storage import LocalEvidenceSink
from app.adapters.keys import LocalKeyWrapper, WrappedKey
from app.api import cases as cases_api
from app.core.case_keys import open_case_key
from app.db.tenancy import TenantContext, set_tenant
from app.models import Case, CustodyEvent, Evidence, Organization, Plan, User
from app.services import evidence_upload as evidence_service
from app.services.evidence_upload import ASSOCIATED_PREFIX
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina


@pytest.fixture(autouse=True)
def storage(app: FastAPI, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(
        cases_api,
        "new_evidence_sink",
        lambda _settings, key: LocalEvidenceSink(tmp_path, key),
    )
    return tmp_path


def _login(dispositivo: NuevoCliente, db: Session, user: User) -> TestClient:
    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(email_verified_at=datetime.datetime.now(datetime.UTC))
    )
    db.flush()
    client = dispositivo()
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": CLAVE})
    assert response.status_code == 204, response.text
    return client


def _case(dispositivo: NuevoCliente, db: Session) -> tuple[Oficina, TestClient, str]:
    office = crear_oficina(db)
    client = _login(dispositivo, db, office.owner)
    response = client.post("/api/v1/cases", json={"title": "Prueba de carga"})
    assert response.status_code == 201, response.text
    return office, client, response.json()["id"]


def _upload(client: TestClient, case_id: str, data: bytes) -> Response:
    return client.post(
        f"/api/v1/cases/{case_id}/evidences",
        data={"tipo": "document", "origen": "Entregado por el cliente"},
        files={"archivo": ("registro.txt", data, "text/plain")},
    )


def test_guarda_huella_custodia_y_cuota(
    dispositivo: NuevoCliente, db: Session, storage: Path, local_key_path: Path
) -> None:
    office, client, case_id = _case(dispositivo, db)
    original = b"evidencia conservada\n" * 5000

    response = _upload(client, case_id, original)

    assert response.status_code == 201, response.text
    assert response.json()["sha256"] == hashlib.sha256(original).hexdigest()
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    evidence = db.scalar(select(Evidence).where(Evidence.id == response.json()["id"]))
    assert evidence is not None
    assert evidence.size_bytes == len(original)
    assert evidence.sha256 == hashlib.sha256(original).digest()
    used = db.scalar(
        select(Organization.storage_used_bytes).where(Organization.id == office.organization_id)
    )
    assert used == len(original)
    events = db.scalar(
        select(func.count()).select_from(CustodyEvent).where(CustodyEvent.case_id == case_id)
    )
    assert events == 2
    encrypted = (storage / evidence.storage_key).read_bytes()
    assert original not in encrypted
    case = db.get(Case, uuid.UUID(case_id))
    assert case is not None
    assert case.wrapped_key is not None
    handle = open_case_key(
        LocalKeyWrapper.from_pem_file(local_key_path),
        WrappedKey(case.wrapped_key, case.key_version),
    )
    cipher = handle.primitive(streaming_aead.StreamingAead)
    associated = ASSOCIATED_PREFIX + case.id.bytes + evidence.id.bytes
    with cipher.new_decrypting_stream(io.BytesIO(encrypted), associated) as reader:
        assert reader.read() == original


def test_no_miembro_recibe_403_sin_objeto(
    dispositivo: NuevoCliente, db: Session, storage: Path
) -> None:
    office, _, case_id = _case(dispositivo, db)
    outsider = crear_miembro(db, office, "ajeno-caso@example.com", "lawyer")
    client = _login(dispositivo, db, outsider)

    response = _upload(client, case_id, b"contenido")

    assert response.status_code == 403
    assert not list(storage.rglob("*.*"))


def test_archivo_excesivo_no_deja_evidencia_ni_cuota(
    dispositivo: NuevoCliente, db: Session, storage: Path
) -> None:
    office, client, case_id = _case(dispositivo, db)
    db.execute(update(Plan).where(Plan.code == "professional").values(max_file_bytes=32))
    db.flush()

    response = _upload(client, case_id, b"A" * 100)

    assert response.status_code == 413
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    evidences = db.scalar(
        select(func.count()).select_from(Evidence).where(Evidence.case_id == case_id)
    )
    used = db.scalar(
        select(Organization.storage_used_bytes).where(Organization.id == office.organization_id)
    )
    events = db.scalar(
        select(func.count()).select_from(CustodyEvent).where(CustodyEvent.case_id == case_id)
    )
    assert evidences == 0
    assert used == 0
    assert events == 1
    assert not list(storage.rglob("*.*"))


def test_carga_interrumpida_limpia_objeto_y_registros(
    dispositivo: NuevoCliente, db: Session, storage: Path
) -> None:
    office, client, case_id = _case(dispositivo, db)
    # El cuerpo acaba dentro del archivo: no llega ni el cierre de la parte ni el del formulario.
    body = (
        b'--limite\r\nContent-Disposition: form-data; name="tipo"\r\n\r\ndocument\r\n'
        b'--limite\r\nContent-Disposition: form-data; name="origen"\r\n\r\nCliente\r\n'
        b'--limite\r\nContent-Disposition: form-data; name="archivo"; '
        b'filename="cortado.txt"\r\nContent-Type: text/plain\r\n\r\n'
        b"bytes incompletos"
    )
    response = client.post(
        f"/api/v1/cases/{case_id}/evidences",
        content=body,
        headers={"Content-Type": "multipart/form-data; boundary=limite"},
    )

    assert response.status_code == 422
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    assert (
        db.scalar(select(func.count()).select_from(Evidence).where(Evidence.case_id == case_id))
        == 0
    )
    assert (
        db.scalar(
            select(Organization.storage_used_bytes).where(Organization.id == office.organization_id)
        )
        == 0
    )
    assert not list(storage.rglob("*.*"))


def test_fallo_al_registrar_limpia_el_objeto_cifrado(
    dispositivo: NuevoCliente,
    db: Session,
    storage: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    office, client, case_id = _case(dispositivo, db)

    def fail_record(*_args: object) -> None:
        raise RuntimeError("falla de base simulada")

    monkeypatch.setattr(evidence_service, "_record", fail_record)
    response = _upload(client, case_id, b"texto ya cifrado")
    assert response.status_code == 500

    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    assert (
        db.scalar(select(func.count()).select_from(Evidence).where(Evidence.case_id == case_id))
        == 0
    )
    assert (
        db.scalar(
            select(Organization.storage_used_bytes).where(Organization.id == office.organization_id)
        )
        == 0
    )
    assert not list(storage.rglob("*.*"))


def test_origen_obligatorio_y_tipo_detectado_persisten(
    dispositivo: NuevoCliente, db: Session, storage: Path
) -> None:
    office, client, case_id = _case(dispositivo, db)
    path = f"/api/v1/cases/{case_id}/evidences"
    rejected = client.post(
        path,
        data={"tipo": "document", "origen": "   "},
        files={"archivo": ("registro.pdf", b"texto legible", "application/pdf")},
    )
    assert rejected.status_code == 422
    assert not list(storage.rglob("*.*"))

    saved = client.post(
        path,
        data={"tipo": "document", "origen": "  Entregado por la cliente  "},
        files={"archivo": ("registro.pdf", b"texto legible", "application/pdf")},
    )
    assert saved.status_code == 201
    listing = client.get(path)
    assert listing.status_code == 200
    assert listing.headers["Cache-Control"] == "no-store"
    assert listing.json()["next_cursor"] is None
    item = listing.json()["items"][0]
    assert item["id"] == saved.json()["id"]
    assert item["declared_origin"] == "Entregado por la cliente"
    assert item["declared_type"] == "document"
    assert item["detected_type"] == "text/plain"
    assert item["sha256"] == hashlib.sha256(b"texto legible").hexdigest()
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    assert (
        db.scalar(select(func.count()).select_from(Evidence).where(Evidence.case_id == case_id))
        == 1
    )


def test_listado_paginado_y_ajeno_404(dispositivo: NuevoCliente, db: Session) -> None:
    office, client, case_id = _case(dispositivo, db)
    for index in range(3):
        assert _upload(client, case_id, f"archivo {index}".encode()).status_code == 201
    path = f"/api/v1/cases/{case_id}/evidences"
    first = client.get(path, params={"limit": 2})
    assert first.status_code == 200
    assert len(first.json()["items"]) == 2
    cursor = first.json()["next_cursor"]
    assert cursor is not None
    second = client.get(path, params={"limit": 2, "cursor": cursor})
    assert second.status_code == 200
    assert len(second.json()["items"]) == 1
    assert second.json()["next_cursor"] is None
    assert {item["id"] for item in first.json()["items"]}.isdisjoint(
        {item["id"] for item in second.json()["items"]}
    )

    outsider = crear_miembro(db, office, "ajeno-listado@example.com", "assistant")
    denied = _login(dispositivo, db, outsider).get(path)
    assert denied.status_code == 404
