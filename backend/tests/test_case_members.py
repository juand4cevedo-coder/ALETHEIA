"""Asignación al caso: permisos, aislamiento y cadena de custodia (HU-016)."""

import datetime
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import CaseMember, CustodyEvent, Membership, User
from app.services import custody_chain
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina

_LOGIN = "/api/v1/auth/login"
_CASES = "/api/v1/cases"


def _login(device: NuevoCliente, db: Session, user: User) -> TestClient:
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


def _case(client: TestClient) -> str:
    response = client.post(_CASES, json={"title": "Caso para asignar"})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


def _context(db: Session, office: Oficina) -> None:
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))


def test_abogado_asigna_y_retira_solo_a_miembro_de_su_despacho(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, "abogado-caso@example.com", "lawyer")
    assistant = crear_miembro(db, office, "asistente-caso@example.com", "assistant")
    client = _login(dispositivo, db, lawyer)
    case_id = _case(client)
    path = f"{_CASES}/{case_id}"

    available = client.get(f"{path}/available-members")
    assert available.status_code == 200
    assert assistant.id in {uuid.UUID(row["user_id"]) for row in available.json()}

    added = client.post(f"{path}/members", json={"user_id": str(assistant.id)})
    assert added.status_code == 204, added.text
    assert added.headers["Cache-Control"] == "no-store"
    assert len(client.get(path).json()["members"]) == 2
    assert assistant.id not in {
        uuid.UUID(row["user_id"]) for row in client.get(f"{path}/available-members").json()
    }
    assert client.post(f"{path}/members", json={"user_id": str(assistant.id)}).status_code == 409

    _context(db, office)
    events = list(
        db.scalars(
            select(CustodyEvent)
            .where(CustodyEvent.case_id == uuid.UUID(case_id))
            .order_by(CustodyEvent.seq)
        )
    )
    assert [event.action for event in events] == ["case_created", "member_added"]
    assert events[1].details == {"user_id": str(assistant.id)}
    assert custody_chain.verify(custody_chain.load(db, uuid.UUID(case_id))).intact

    removed = client.delete(f"{path}/members/{assistant.id}")
    assert removed.status_code == 204, removed.text
    assert len(client.get(path).json()["members"]) == 1
    _context(db, office)
    assert db.scalar(select(Membership.id).where(Membership.user_id == assistant.id)) is not None
    assert (
        db.scalar(
            select(CaseMember).where(
                CaseMember.case_id == uuid.UUID(case_id), CaseMember.user_id == assistant.id
            )
        )
        is None
    )
    assert custody_chain.verify(custody_chain.load(db, uuid.UUID(case_id))).intact


def test_cadena_paginada_para_miembros_sin_edicion(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    assistant = crear_miembro(db, office, "lector-cadena@example.com", "assistant")
    outsider = crear_miembro(db, office, "ajeno-cadena@example.com", "lawyer")
    owner_client = _login(dispositivo, db, office.owner)
    case_id = _case(owner_client)
    path = f"{_CASES}/{case_id}/custody-events"
    assert (
        owner_client.post(
            f"{_CASES}/{case_id}/members", json={"user_id": str(assistant.id)}
        ).status_code
        == 204
    )
    assistant_client = _login(dispositivo, db, assistant)
    assert assistant_client.get(path).status_code == 200
    assert owner_client.delete(f"{_CASES}/{case_id}/members/{assistant.id}").status_code == 204

    first = owner_client.get(path, params={"limit": 2})
    assert first.status_code == 200, first.text
    assert first.headers["Cache-Control"] == "no-store"
    assert [event["seq"] for event in first.json()["items"]] == [3, 2]
    assert [event["action"] for event in first.json()["items"]] == [
        "member_removed",
        "member_added",
    ]
    assert all(event["actor_name"] == office.owner.full_name for event in first.json()["items"])
    assert first.json()["next_cursor"] == 2
    second = owner_client.get(path, params={"cursor": 2, "limit": 2})
    assert [event["seq"] for event in second.json()["items"]] == [1]
    assert second.json()["next_cursor"] is None
    assert owner_client.patch(path, json={"action": "changed"}).status_code == 405
    assert owner_client.delete(path).status_code == 405
    assert owner_client.get(path, params={"cursor": 0}).status_code == 422

    outsider_client = _login(dispositivo, db, outsider)
    assert outsider_client.get(path).status_code == 404
    assert outsider_client.get(f"{_CASES}/{case_id}/custody-verification").status_code == 404
    # El asistente estuvo asignado pero ya no lo está: no conserva acceso.
    assert assistant_client.get(path).status_code == 404


def test_no_asigna_a_otra_organizacion_ni_a_una_persona_inexistente(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    other = crear_oficina(db)
    client = _login(dispositivo, db, office.owner)
    case_id = _case(client)
    path = f"{_CASES}/{case_id}/members"
    for target in (other.owner.id, uuid.uuid7()):
        assert client.post(path, json={"user_id": str(target)}).status_code == 404
    _context(db, office)
    assert (
        db.scalar(
            select(CustodyEvent.seq)
            .where(CustodyEvent.case_id == uuid.UUID(case_id))
            .order_by(CustodyEvent.seq.desc())
            .limit(1)
        )
        == 1
    )


def test_asistente_y_abogado_no_asignado_no_administran_el_caso(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    assistant = crear_miembro(db, office, "asistente-sin-permiso@example.com", "assistant")
    lawyer = crear_miembro(db, office, "abogado-no-asignado@example.com", "lawyer")
    owner_client = _login(dispositivo, db, office.owner)
    case_id = _case(owner_client)
    path = f"{_CASES}/{case_id}"
    assert (
        owner_client.post(f"{path}/members", json={"user_id": str(assistant.id)}).status_code == 204
    )

    assistant_client = _login(dispositivo, db, assistant)
    assert assistant_client.get(f"{path}/available-members").status_code == 403
    assert (
        assistant_client.post(f"{path}/members", json={"user_id": str(lawyer.id)}).status_code
        == 403
    )
    assert assistant_client.delete(f"{path}/members/{office.owner.id}").status_code == 403

    lawyer_client = _login(dispositivo, db, lawyer)
    assert lawyer_client.get(f"{path}/available-members").status_code == 404
    assert (
        lawyer_client.post(f"{path}/members", json={"user_id": str(lawyer.id)}).status_code == 404
    )
    assert lawyer_client.delete(f"{path}/members/{assistant.id}").status_code == 404
