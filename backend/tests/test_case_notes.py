"""Notas internas de un caso: quién las lee, quién las escribe y qué queda registrado."""

import datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import AuditLog, User
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, crear_miembro, crear_oficina

_CASES = "/api/v1/cases"
_LOGIN = "/api/v1/auth/login"


def _session(device: NuevoCliente, db: Session, user: User) -> Any:
    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(email_verified_at=datetime.datetime.now(datetime.UTC))
    )
    db.flush()
    client = device()
    response = client.post(_LOGIN, json={"email": user.email, "password": CLAVE})
    assert response.status_code == 204, response.text
    return client


def test_los_miembros_escriben_y_leen_notas_en_orden_reciente(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, "abogada.notas@example.com", "lawyer")
    assistant = crear_miembro(db, office, "asistente.notas@example.com", "assistant")
    lawyer_client = _session(dispositivo, db, lawyer)
    case_id = lawyer_client.post(_CASES, json={"title": "Caso con notas"}).json()["id"]
    lawyer_client.post(f"{_CASES}/{case_id}/members", json={"user_id": str(assistant.id)})

    first = lawyer_client.post(f"{_CASES}/{case_id}/notes", json={"body": "  Llamar al cliente  "})
    assert first.status_code == 201, first.text
    assert first.headers["Cache-Control"] == "no-store"
    assert first.json()["body"] == "Llamar al cliente"
    assert first.json()["author_name"] == lawyer.full_name

    assistant_client = _session(dispositivo, db, assistant)
    second = assistant_client.post(f"{_CASES}/{case_id}/notes", json={"body": "Cliente confirmó"})
    assert second.status_code == 201, second.text

    listed = lawyer_client.get(f"{_CASES}/{case_id}/notes")
    assert listed.status_code == 200, listed.text
    assert [item["body"] for item in listed.json()["items"]] == [
        "Cliente confirmó",
        "Llamar al cliente",
    ]
    page = lawyer_client.get(f"{_CASES}/{case_id}/notes", params={"limit": 1}).json()
    assert len(page["items"]) == 1
    assert page["next_cursor"] == page["items"][0]["id"]
    rest = lawyer_client.get(
        f"{_CASES}/{case_id}/notes", params={"limit": 1, "cursor": page["next_cursor"]}
    ).json()
    assert [item["body"] for item in rest["items"]] == ["Llamar al cliente"]
    assert rest["next_cursor"] is None


def test_quien_no_es_miembro_ni_de_otro_despacho_no_ve_ni_escribe_notas(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    stranger = crear_miembro(db, office, "ajeno.notas@example.com", "lawyer")
    other_office = crear_oficina(db)
    owner_client = _session(dispositivo, db, office.owner)
    case_id = owner_client.post(_CASES, json={"title": "Caso reservado"}).json()["id"]
    owner_client.post(f"{_CASES}/{case_id}/notes", json={"body": "Reservada"})

    for user in (stranger, other_office.owner):
        client = _session(dispositivo, db, user)
        assert client.get(f"{_CASES}/{case_id}/notes").status_code == 404
        assert client.post(f"{_CASES}/{case_id}/notes", json={"body": "Intruso"}).status_code == 404
    assert dispositivo().get(f"{_CASES}/{case_id}/notes").status_code == 401


def test_la_nota_deja_constancia_sin_copiar_su_texto_y_no_se_edita(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    case_id = client.post(_CASES, json={"title": "Caso auditado"}).json()["id"]
    created = client.post(f"{_CASES}/{case_id}/notes", json={"body": "Dato sensible del cliente"})
    note_id = created.json()["id"]

    event = db.scalars(select(AuditLog).where(AuditLog.target_id == note_id)).one()
    assert event.action == "case_note_created"
    assert event.details == {"case_id": case_id, "length": len("Dato sensible del cliente")}
    assert "sensible" not in str(event.details)
    # La API no ofrece editar ni borrar: la corrección es una nota nueva.
    assert (
        client.patch(f"{_CASES}/{case_id}/notes/{note_id}", json={"body": "x"}).status_code == 404
    )
    assert client.delete(f"{_CASES}/{case_id}/notes/{note_id}").status_code in (404, 405)


def test_un_caso_archivado_conserva_sus_notas_pero_no_admite_nuevas(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    case_id = client.post(_CASES, json={"title": "Caso a archivar"}).json()["id"]
    client.post(f"{_CASES}/{case_id}/notes", json={"body": "Antes de cerrar"})
    closed = client.post(f"{_CASES}/{case_id}/close")
    assert closed.status_code in (200, 204), closed.text

    assert client.get(f"{_CASES}/{case_id}/notes").json()["items"][0]["body"] == "Antes de cerrar"
    late = client.post(f"{_CASES}/{case_id}/notes", json={"body": "Después de cerrar"})
    assert late.status_code == 409


def test_la_nota_exige_texto_dentro_de_los_limites(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    case_id = client.post(_CASES, json={"title": "Caso con límites"}).json()["id"]

    assert client.post(f"{_CASES}/{case_id}/notes", json={"body": ""}).status_code == 422
    assert client.post(f"{_CASES}/{case_id}/notes", json={"body": "x" * 4001}).status_code == 422
    assert client.post(f"{_CASES}/{case_id}/notes", json={"body": "x" * 4000}).status_code == 201
    assert (
        client.post(f"{_CASES}/{case_id}/notes", json={"body": "ok", "extra": 1}).status_code == 422
    )


def test_una_nota_solo_con_espacios_se_rechaza(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, "abogada.vacia@example.com", "lawyer")
    client = _session(dispositivo, db, lawyer)
    case_id = client.post(_CASES, json={"title": "Caso sin notas vacias"}).json()["id"]

    response = client.post(f"{_CASES}/{case_id}/notes", json={"body": "   \n  "})

    assert response.status_code == 422
