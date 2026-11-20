"""HU-018: huella, autorización, topes y limpieza de una carga fallida."""

import datetime
import hashlib
import io
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from botocore.exceptions import EndpointConnectionError
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
from app.services import evidence_download as evidence_download_service
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
    monkeypatch.setattr(
        evidence_download_service,
        "open_encrypted_evidence",
        lambda _settings, key: (tmp_path / key).open("rb"),
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


def test_detalle_muestra_huella_sello_y_eventos_solo_al_miembro(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office, client, case_id = _case(dispositivo, db)
    payload = b"contenido para detalle"
    uploaded = _upload(client, case_id, payload)
    assert uploaded.status_code == 201
    evidence_id = uploaded.json()["id"]
    path = f"/api/v1/cases/{case_id}/evidences/{evidence_id}"

    detail = client.get(path)
    assert detail.status_code == 200
    assert detail.headers["Cache-Control"] == "no-store"
    body = detail.json()
    assert body["sha256"] == hashlib.sha256(payload).hexdigest()
    assert body["size_bytes"] == len(payload)
    assert body["declared_origin"] == "Entregado por el cliente"
    assert body["tsa_status"] == "pending"
    assert body["tsa_time"] is None
    assert body["next_event_seq"] is None
    assert len(body["events"]) == 1
    assert body["events"][0]["action"] == "evidence_uploaded"
    assert body["events"][0]["actor_name"] == office.owner.full_name
    assert len(body["events"][0]["event_hash"]) == 64
    assert "tsa_token" not in body
    assert "storage_key" not in body

    missing = client.get(f"/api/v1/cases/{case_id}/evidences/{uuid.uuid4()}")
    other_case = client.post("/api/v1/cases", json={"title": "Otro caso"})
    assert other_case.status_code == 201
    wrong_case = client.get(f"/api/v1/cases/{other_case.json()['id']}/evidences/{evidence_id}")
    outsider = crear_miembro(db, office, "ajeno-detalle@example.com", "assistant")
    denied = _login(dispositivo, db, outsider).get(path)
    other_office = crear_oficina(db)
    cross_organization = _login(dispositivo, db, other_office.owner).get(path)
    assert all(
        response.status_code == 404
        for response in (missing, wrong_case, denied, cross_organization)
    )
    assert {
        response.json()["detail"] for response in (missing, wrong_case, denied, cross_organization)
    } == {"No encontramos lo que busca o no tiene acceso a ello."}


def test_descarga_entrega_original_y_registra_custodia(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office, client, case_id = _case(dispositivo, db)
    original = b"archivo original\n" * 10000
    uploaded = _upload(client, case_id, original)
    assert uploaded.status_code == 201
    evidence_id = uploaded.json()["id"]

    downloaded = client.get(f"/api/v1/cases/{case_id}/evidences/{evidence_id}/download")

    assert downloaded.status_code == 200
    assert downloaded.content == original
    assert hashlib.sha256(downloaded.content).hexdigest() == uploaded.json()["sha256"]
    assert downloaded.headers["Cache-Control"] == "no-store"
    assert downloaded.headers["Content-Length"] == str(len(original))
    assert downloaded.headers["Content-Disposition"].startswith("attachment;")
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    events = list(
        db.scalars(
            select(CustodyEvent)
            .where(CustodyEvent.evidence_id == uuid.UUID(evidence_id))
            .order_by(CustodyEvent.seq)
        )
    )
    assert [event.action for event in events] == ["evidence_uploaded", "evidence_downloaded"]


def test_asistente_no_descarga_y_no_miembro_no_conoce_la_evidencia(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office, owner, case_id = _case(dispositivo, db)
    uploaded = _upload(owner, case_id, b"reservado")
    evidence_id = uploaded.json()["id"]
    assistant = crear_miembro(db, office, "asistente-descarga@example.com", "assistant")
    outsider = crear_miembro(db, office, "ajeno-descarga@example.com", "lawyer")
    added = owner.post(f"/api/v1/cases/{case_id}/members", json={"user_id": str(assistant.id)})
    assert added.status_code == 204
    path = f"/api/v1/cases/{case_id}/evidences/{evidence_id}/download"

    assert _login(dispositivo, db, assistant).get(path).status_code == 403
    assert _login(dispositivo, db, outsider).get(path).status_code == 404
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    assert (
        db.scalar(
            select(func.count())
            .select_from(CustodyEvent)
            .where(CustodyEvent.evidence_id == uuid.UUID(evidence_id))
        )
        == 1
    )


@pytest.mark.parametrize("durante_lectura", [False, True])
def test_eliminacion_impide_descargar_el_original(
    dispositivo: NuevoCliente, db: Session, monkeypatch: pytest.MonkeyPatch, durante_lectura: bool
) -> None:
    office, client, case_id = _case(dispositivo, db)
    evidence_id = _upload(client, case_id, b"original").json()["id"]

    def iniciar_eliminacion() -> None:
        set_tenant(db, TenantContext(office.organization_id, office.owner.id))
        db.execute(
            update(Case)
            .where(Case.id == case_id)
            .values(status="deleting", closed_at=datetime.datetime.now(datetime.UTC))
        )
        db.commit()

    if durante_lectura:
        leer = evidence_download_service.PreparedDownload.chunks

        def leer_y_cerrar(download: evidence_download_service.PreparedDownload) -> Iterator[bytes]:
            yield from leer(download)
            iniciar_eliminacion()

        monkeypatch.setattr(evidence_download_service.PreparedDownload, "chunks", leer_y_cerrar)
    else:
        iniciar_eliminacion()

    response = client.get(f"/api/v1/cases/{case_id}/evidences/{evidence_id}/download")
    assert response.status_code == 404
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    assert (
        db.scalar(
            select(CustodyEvent.id).where(
                CustodyEvent.evidence_id == evidence_id,
                CustodyEvent.action == "evidence_downloaded",
            )
        )
        is None
    )


def test_descarga_sin_almacenamiento_responde_con_error_transitorio(
    dispositivo: NuevoCliente, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, client, case_id = _case(dispositivo, db)
    evidence_id = _upload(client, case_id, b"original").json()["id"]

    def no_disponible(_settings: object, _key: str) -> None:
        raise EndpointConnectionError(endpoint_url="https://almacenamiento.invalid")

    monkeypatch.setattr(evidence_download_service, "open_encrypted_evidence", no_disponible)
    response = client.get(f"/api/v1/cases/{case_id}/evidences/{evidence_id}/download")
    assert response.status_code == 503
    assert response.headers["Cache-Control"] == "no-store"


def test_archivo_corrupto_no_se_descarga_ni_registra_evento(
    dispositivo: NuevoCliente, db: Session, storage: Path
) -> None:
    office, client, case_id = _case(dispositivo, db)
    uploaded = _upload(client, case_id, "archivo válido".encode())
    evidence_id = uploaded.json()["id"]
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    evidence = db.get(Evidence, uuid.UUID(evidence_id))
    assert evidence is not None
    encrypted = storage / evidence.storage_key
    data = bytearray(encrypted.read_bytes())
    data[-1] ^= 1
    encrypted.write_bytes(data)

    response = client.get(f"/api/v1/cases/{case_id}/evidences/{evidence_id}/download")

    assert response.status_code == 503
    assert (
        db.scalar(
            select(func.count())
            .select_from(CustodyEvent)
            .where(CustodyEvent.evidence_id == uuid.UUID(evidence_id))
        )
        == 1
    )


def test_descarga_sigue_disponible_en_solo_lectura(dispositivo: NuevoCliente, db: Session) -> None:
    office, client, case_id = _case(dispositivo, db)
    uploaded = _upload(client, case_id, b"disponible")
    db.execute(
        update(Organization)
        .where(Organization.id == office.organization_id)
        .values(status="read_only")
    )
    db.flush()

    response = client.get(f"/api/v1/cases/{case_id}/evidences/{uploaded.json()['id']}/download")

    assert response.status_code == 200
    assert response.content == b"disponible"


def test_descarga_sigue_disponible_con_textos_pendientes(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office, client, case_id = _case(dispositivo, db)
    uploaded = _upload(client, case_id, b"original")
    db.execute(
        update(User)
        .where(User.id == office.owner.id)
        .values(terms_version="2026-01-01", privacy_version="2026-01-01")
    )
    db.flush()
    path = f"/api/v1/cases/{case_id}/evidences/{uploaded.json()['id']}"

    assert client.get(path).status_code == 403
    response = client.get(f"{path}/download")

    assert response.status_code == 200
    assert response.content == b"original"
