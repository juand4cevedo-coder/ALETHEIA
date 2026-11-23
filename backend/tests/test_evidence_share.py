"""Compartir una evidencia: enlaces que vencen, se revocan y dejan rastro en la cadena."""

import datetime
import hashlib
import uuid
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.adapters.evidence_storage import LocalEvidenceSink
from app.api import cases as cases_api
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, CustodyEvent, EvidenceShareLink, User
from app.services import evidence_download as evidence_download_service
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina

_BODY = b"contenido de la evidencia\n" * 2000


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


def _evidence(dispositivo: NuevoCliente, db: Session) -> tuple[Oficina, TestClient, str, str]:
    office = crear_oficina(db)
    client = _login(dispositivo, db, office.owner)
    case_id = client.post("/api/v1/cases", json={"title": "Caso para compartir"}).json()["id"]
    uploaded = client.post(
        f"/api/v1/cases/{case_id}/evidences",
        data={"tipo": "document", "origen": "Entregado por el cliente"},
        files={"archivo": ("informe.txt", _BODY, "text/plain")},
    )
    assert uploaded.status_code == 201, uploaded.text
    return office, client, case_id, uploaded.json()["id"]


def _links_path(case_id: str, evidence_id: str) -> str:
    return f"/api/v1/cases/{case_id}/evidences/{evidence_id}/share-links"


def _download(client: TestClient, settings: Settings, token: str) -> Any:
    return client.post(
        "/api/v1/shared-evidence/download",
        data={"token": token},
        headers={"Origin": settings.public_url, "Sec-Fetch-Site": "same-origin"},
    )


def _actions(db: Session, office: Oficina, case_id: str) -> list[tuple[str, uuid.UUID | None]]:
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    rows = db.execute(
        select(CustodyEvent.action, CustodyEvent.actor_user_id)
        .where(CustodyEvent.case_id == uuid.UUID(case_id))
        .order_by(CustodyEvent.seq)
    ).all()
    return [(action, actor) for action, actor in rows]


def test_se_crea_un_enlace_y_queda_en_la_cadena_sin_guardar_el_enlace(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office, client, case_id, evidence_id = _evidence(dispositivo, db)

    created = client.post(
        _links_path(case_id, evidence_id), json={"expires_in_hours": 48, "label": "Para el perito"}
    )

    assert created.status_code == 201, created.text
    assert created.headers["cache-control"] == "no-store"
    body = created.json()
    assert "/compartido#t=" in body["url"]
    assert body["link"]["status"] == "active"
    assert body["link"]["label"] == "Para el perito"
    assert body["link"]["download_count"] == 0
    listed = client.get(_links_path(case_id, evidence_id)).json()["items"]
    assert [item["id"] for item in listed] == [body["link"]["id"]]
    # El enlace completo no se guarda: la fila solo lleva su identificador y su vigencia.
    token = body["url"].split("#t=", 1)[1]
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    row = db.scalars(select(EvidenceShareLink)).one()
    assert token not in str(row.__dict__)
    assert _actions(db, office, case_id)[-1] == ("evidence_link_created", office.owner.id)


def test_quien_tiene_el_enlace_descarga_el_original_y_queda_constancia(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, client, case_id, evidence_id = _evidence(dispositivo, db)
    token = client.post(_links_path(case_id, evidence_id), json={}).json()["url"].split("#t=")[1]
    outsider = dispositivo()

    info = outsider.post("/api/v1/shared-evidence/inspect", json={"token": token})
    assert info.status_code == 200, info.text
    assert info.json()["filename"] == "informe.txt"
    assert info.json()["sha256"] == hashlib.sha256(_BODY).hexdigest()

    downloaded = _download(outsider, settings, token)

    assert downloaded.status_code == 200, downloaded.text
    assert downloaded.content == _BODY
    assert downloaded.headers["Cache-Control"] == "no-store"
    assert downloaded.headers["Content-Disposition"].startswith("attachment;")
    assert downloaded.headers["X-Content-Type-Options"] == "nosniff"
    # La descarga queda en la cadena con actor nulo y en la auditoría con la IP.
    assert _actions(db, office, case_id)[-1] == ("evidence_link_downloaded", None)
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    audit = db.scalars(select(AuditLog).where(AuditLog.action == "evidence_link_downloaded")).all()
    assert len(audit) == 1
    assert audit[0].actor_user_id is None
    link = client.get(_links_path(case_id, evidence_id)).json()["items"][0]
    assert link["download_count"] == 1
    assert link["last_downloaded_at"] is not None


def test_revocar_corta_el_enlace_y_lo_deja_en_la_cadena(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, client, case_id, evidence_id = _evidence(dispositivo, db)
    created = client.post(_links_path(case_id, evidence_id), json={}).json()
    token = created["url"].split("#t=")[1]
    outsider = dispositivo()
    assert (
        outsider.post("/api/v1/shared-evidence/inspect", json={"token": token}).status_code == 200
    )

    revoked = client.delete(f"{_links_path(case_id, evidence_id)}/{created['link']['id']}")

    assert revoked.status_code == 204, revoked.text
    assert (
        outsider.post("/api/v1/shared-evidence/inspect", json={"token": token}).status_code == 404
    )
    gone = _download(outsider, settings, token)
    assert gone.status_code == 404
    assert gone.headers["Cache-Control"] == "no-store"
    assert client.get(_links_path(case_id, evidence_id)).json()["items"][0]["status"] == "revoked"
    assert _actions(db, office, case_id)[-1] == ("evidence_link_revoked", office.owner.id)
    # Revocar otra vez no deja otro evento.
    assert (
        client.delete(f"{_links_path(case_id, evidence_id)}/{created['link']['id']}").status_code
        == 204
    )
    assert [a for a, _ in _actions(db, office, case_id)].count("evidence_link_revoked") == 1


def test_un_enlace_vencido_o_alterado_no_sirve(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, client, case_id, evidence_id = _evidence(dispositivo, db)
    token = client.post(_links_path(case_id, evidence_id), json={}).json()["url"].split("#t=")[1]
    outsider = dispositivo()

    for bad in ("", "basura", token[:-3] + "abc"):
        response = outsider.post("/api/v1/shared-evidence/inspect", json={"token": bad or "x"})
        assert response.status_code == 404

    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    db.execute(
        update(EvidenceShareLink).values(
            expires_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=1)
        )
    )
    db.flush()
    assert (
        outsider.post("/api/v1/shared-evidence/inspect", json={"token": token}).status_code == 404
    )
    assert _download(outsider, settings, token).status_code == 404
    listed = client.get(_links_path(case_id, evidence_id)).json()["items"][0]
    assert listed["status"] == "expired"


def test_solo_quien_puede_descargar_originales_comparte(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office, client, case_id, evidence_id = _evidence(dispositivo, db)
    assistant = crear_miembro(db, office, "asistente-comparte@example.com", "assistant")
    outsider = crear_miembro(db, office, "ajeno-comparte@example.com", "lawyer")
    other_office = crear_oficina(db)
    path = _links_path(case_id, evidence_id)

    # Un asistente no descarga originales, así que tampoco los comparte.
    client.post(f"/api/v1/cases/{case_id}/members", json={"user_id": str(assistant.id)})
    assert _login(dispositivo, db, assistant).post(path, json={}).status_code == 403
    # Quien no es miembro del caso, o es de otro despacho, ni siquiera lo ve.
    assert _login(dispositivo, db, outsider).post(path, json={}).status_code == 404
    assert _login(dispositivo, db, other_office.owner).post(path, json={}).status_code == 404
    assert dispositivo().post(path, json={}).status_code == 401
    for body in ({"expires_in_hours": 0}, {"expires_in_hours": 721}, {"label": ""}):
        assert client.post(path, json=body).status_code == 422, body
