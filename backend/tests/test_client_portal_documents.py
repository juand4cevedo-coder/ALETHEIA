"""Documentos del portal: copias cifradas que el despacho sube y el cliente descarga (ADR-054)."""

import hashlib
import re
import uuid
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.evidence_storage import LocalEvidenceSink
from app.api import client_portal as portal_api
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, ClientPortalDocument, CustodyEvent, Job, Organization
from app.services import client_portal_documents as documents_service
from app.services import evidence_download as evidence_download_service
from app.services.client_portal import INVITE_TEMPLATE, NEWS_TEMPLATE
from app.services.client_portal_emails import invite_email, news_email
from tests.conftest import NuevoCliente
from tests.organizations import Oficina, crear_miembro, crear_oficina
from tests.test_case_notes import _session
from tests.test_client_portal import _invites

_CASES = "/api/v1/cases"
_VIEW = "/api/v1/client-portal/view"
_ACCEPT = "/api/v1/client-portal/accept-notice"
_DOWNLOAD = "/api/v1/client-portal/documents/download"
_BODY = b"copia para el cliente\n" * 500


@pytest.fixture(autouse=True)
def storage(app: FastAPI, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(
        portal_api,
        "new_evidence_sink",
        lambda _settings, key: LocalEvidenceSink(tmp_path, key),
    )
    monkeypatch.setattr(
        documents_service,
        "delete_evidence_object",
        lambda _settings, key: (tmp_path / key).unlink(missing_ok=True),
    )
    monkeypatch.setattr(
        evidence_download_service,
        "open_encrypted_evidence",
        lambda _settings, key: (tmp_path / key).open("rb"),
    )
    return tmp_path


def _upload(
    client: TestClient, case_id: str, name: str = "resumen.pdf", body: bytes = _BODY
) -> Any:
    return client.post(
        f"{_CASES}/{case_id}/portal/documents",
        data={"tipo": "document", "origen": "Copia para el cliente"},
        files={"archivo": (name, body, "application/octet-stream")},
    )


def _setup(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> tuple[Oficina, TestClient, str, TestClient, str]:
    """Un despacho con un caso, un cliente que ya aceptó el aviso y su enlace."""
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, f"abogada-{uuid.uuid4().hex[:6]}@example.com", "lawyer")
    client = _session(dispositivo, db, lawyer)
    case_id = client.post(_CASES, json={"title": "Caso con documentos"}).json()["id"]
    client.post(
        f"{_CASES}/{case_id}/portal/accesses",
        json={"client_name": "María Pérez", "client_email": "cliente@example.com"},
    )
    payload = _invites(db)[-1]
    assert payload["template"] == INVITE_TEMPLATE
    email = invite_email(db, payload, settings)
    assert email is not None
    found = re.search(r"#t=([\w.-]+)", email.text)
    assert found is not None
    token = found.group(1)
    anonymous = dispositivo()
    assert anonymous.post(_ACCEPT, json={"token": token}).status_code == 204
    return office, client, case_id, anonymous, token


def _download(client: TestClient, settings: Settings, token: str, document_id: str) -> Any:
    return client.post(
        _DOWNLOAD,
        data={"token": token, "document_id": document_id},
        headers={"Origin": settings.public_url, "Sec-Fetch-Site": "same-origin"},
    )


def _audit(db: Session, office: Oficina, action: str) -> int:
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    return len(db.scalars(select(AuditLog).where(AuditLog.action == action)).all())


def test_el_despacho_sube_una_copia_y_el_cliente_la_descarga_verificada(
    dispositivo: NuevoCliente, db: Session, settings: Settings, storage: Path
) -> None:
    office, lawyer, case_id, anonymous, token = _setup(dispositivo, db, settings)

    uploaded = _upload(lawyer, case_id)

    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]
    assert uploaded.json()["filename"] == "resumen.pdf"
    listed = lawyer.get(f"{_CASES}/{case_id}/portal/documents").json()["items"]
    assert [item["id"] for item in listed] == [document_id]
    assert listed[0]["sha256"] == hashlib.sha256(_BODY).hexdigest()
    stored = list(storage.rglob("evidences/*"))
    assert len(stored) == 1
    assert _BODY[:20] not in stored[0].read_bytes()  # va cifrado

    seen = anonymous.post(_VIEW, json={"token": token}).json()["documents"]
    assert [(item["id"], item["filename"]) for item in seen] == [(document_id, "resumen.pdf")]
    assert "storage_key" not in str(seen)

    response = _download(anonymous, settings, token, document_id)

    assert response.status_code == 200, response.text
    assert response.content == _BODY
    assert response.headers["Cache-Control"] == "no-store"
    assert "resumen.pdf" in response.headers["Content-Disposition"]
    assert _audit(db, office, "client_portal_document_added") == 1
    assert _audit(db, office, "client_portal_document_downloaded") == 1


def test_una_copia_no_toca_la_cadena_de_custodia_y_cuenta_para_el_espacio(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, lawyer, case_id, _, _ = _setup(dispositivo, db, settings)
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    before = db.scalar(select(Organization.storage_used_bytes))
    events_before = len(db.scalars(select(CustodyEvent)).all())

    assert _upload(lawyer, case_id).status_code == 201

    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    db.expire_all()
    assert db.scalar(select(Organization.storage_used_bytes)) == (before or 0) + len(_BODY)
    assert len(db.scalars(select(CustodyEvent)).all()) == events_before


def test_el_cliente_no_descarga_sin_aceptar_ni_un_documento_quitado_ni_con_enlace_cerrado(
    dispositivo: NuevoCliente, db: Session, settings: Settings, storage: Path
) -> None:
    office, lawyer, case_id, anonymous, token = _setup(dispositivo, db, settings)
    document_id = _upload(lawyer, case_id).json()["id"]
    assert len(list(storage.rglob("evidences/*"))) == 1
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    used = db.scalar(select(Organization.storage_used_bytes))
    assert used == len(_BODY)

    removed = lawyer.delete(f"{_CASES}/{case_id}/portal/documents/{document_id}")
    again = lawyer.delete(f"{_CASES}/{case_id}/portal/documents/{document_id}")

    assert removed.status_code == 204
    assert again.status_code == 204
    assert list(storage.rglob("evidences/*")) == []  # el objeto cifrado se borró
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    db.expire_all()
    assert db.scalar(select(Organization.storage_used_bytes)) == 0  # y el espacio volvió
    assert _download(anonymous, settings, token, document_id).status_code == 404
    assert anonymous.post(_VIEW, json={"token": token}).json()["documents"] == []
    assert lawyer.get(f"{_CASES}/{case_id}/portal/documents").json()["items"] == []
    assert _audit(db, office, "client_portal_document_removed") == 1
    assert _download(anonymous, settings, "inventado", document_id).status_code == 404


def test_otro_cliente_o_otro_caso_no_alcanza_el_documento(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    _, lawyer, case_id, anonymous, token = _setup(dispositivo, db, settings)
    other_case = lawyer.post(_CASES, json={"title": "Otro caso"}).json()["id"]
    foreign = _upload(lawyer, other_case).json()["id"]

    assert _upload(lawyer, case_id).status_code == 201

    assert _download(anonymous, settings, token, foreign).status_code == 404


def test_solo_quien_maneja_el_portal_sube_y_lista_documentos(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, lawyer, case_id, _, _ = _setup(dispositivo, db, settings)
    assistant = crear_miembro(db, office, "asistente.docs@example.com", "assistant")
    lawyer.post(f"{_CASES}/{case_id}/members", json={"user_id": str(assistant.id)})
    assistant_client = _session(dispositivo, db, assistant)
    stranger = crear_miembro(db, office, "ajena.docs@example.com", "lawyer")
    stranger_client = _session(dispositivo, db, stranger)

    assert _upload(assistant_client, case_id).status_code == 403
    assert assistant_client.get(f"{_CASES}/{case_id}/portal/documents").status_code == 403
    assert _upload(stranger_client, case_id).status_code == 404
    assert stranger_client.get(f"{_CASES}/{case_id}/portal/documents").status_code == 404


def test_un_caso_archivado_no_admite_documentos_nuevos_y_el_archivo_grande_se_rechaza(
    dispositivo: NuevoCliente, db: Session, settings: Settings, storage: Path
) -> None:
    _, lawyer, case_id, _, _ = _setup(dispositivo, db, settings)
    too_big = _upload(lawyer, case_id, "grande.bin", b"x" * (25 * 1024 * 1024 + 1))
    assert too_big.status_code == 413
    assert list(storage.rglob("evidences/*")) == []

    assert lawyer.post(f"{_CASES}/{case_id}/close").status_code == 200

    assert _upload(lawyer, case_id).status_code == 409


def test_un_formulario_invalido_no_deja_restos(
    dispositivo: NuevoCliente, db: Session, settings: Settings, storage: Path
) -> None:
    office, lawyer, case_id, _, _ = _setup(dispositivo, db, settings)

    response = lawyer.post(
        f"{_CASES}/{case_id}/portal/documents",
        data={"tipo": "document"},
        files={"archivo": ("a.pdf", _BODY, "application/octet-stream")},
    )

    assert response.status_code == 422
    assert list(storage.rglob("evidences/*")) == []
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    assert db.scalars(select(ClientPortalDocument)).all() == []


def test_subir_un_documento_avisa_al_cliente_sin_decir_cual(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    _, lawyer, case_id, _, _ = _setup(dispositivo, db, settings)

    assert _upload(lawyer, case_id, "secreto.pdf").status_code == 201

    jobs = db.scalars(select(Job).where(Job.kind == "email_send")).all()
    news = [job for job in jobs if job.payload.get("template") == NEWS_TEMPLATE]
    assert len(news) == 1
    email = news_email(db, dict(news[0].payload), settings)
    assert email is not None
    assert "secreto.pdf" not in email.text
