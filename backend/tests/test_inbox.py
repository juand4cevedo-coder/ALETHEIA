"""Avisos dentro de la aplicación: la campana y su panel (ADR-063)."""

import datetime
import uuid
from typing import Any

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import User
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, crear_miembro, crear_oficina

_CASES = "/api/v1/cases"
_AVISOS = "/api/v1/notifications"


def _session(device: NuevoCliente, db: Session, user: User) -> Any:
    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(email_verified_at=datetime.datetime.now(datetime.UTC))
    )
    db.flush()
    client = device()
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": CLAVE})
    assert response.status_code == 204, response.text
    return client


def test_asignar_una_tarea_deja_un_aviso_solo_a_quien_la_recibe(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, "abogada.avisos@example.com", "lawyer")
    assistant = crear_miembro(db, office, "asistente.avisos@example.com", "assistant")
    lawyer_client = _session(dispositivo, db, lawyer)
    case_id = lawyer_client.post(_CASES, json={"title": "Sucesión Gómez"}).json()["id"]
    added = lawyer_client.post(f"{_CASES}/{case_id}/members", json={"user_id": str(assistant.id)})
    assert added.status_code == 204, added.text
    created = lawyer_client.post(
        f"{_CASES}/{case_id}/tasks",
        json={"title": "Preparar cronología", "priority": "high", "assigned_to": str(assistant.id)},
    )
    assert created.status_code == 201, created.text

    assistant_client = _session(dispositivo, db, assistant)
    inbox = assistant_client.get(_AVISOS)

    assert inbox.status_code == 200, inbox.text
    assert inbox.headers["Cache-Control"] == "no-store"
    body = inbox.json()
    assert body["unread"] == 2
    assert [item["kind"] for item in body["items"]] == ["task_assigned", "case_member_added"]
    tarea = body["items"][0]
    assert tarea["title"] == "Nueva tarea en Sucesión Gómez"
    assert tarea["body"] == "Preparar cronología"
    assert tarea["link"] == f"/app/casos/{case_id}#tareas"
    assert tarea["read"] is False
    # Quien asignó la tarea no recibe aviso de lo que hizo, ni ve los de su colega.
    assert lawyer_client.get(_AVISOS).json() == {"items": [], "unread": 0}
    ajeno = lawyer_client.post(f"{_AVISOS}/{tarea['id']}/read")
    assert ajeno.status_code == 404

    assert assistant_client.post(f"{_AVISOS}/{tarea['id']}/read").status_code == 204
    after_one = assistant_client.get(_AVISOS).json()
    assert after_one["unread"] == 1
    assert after_one["items"][0]["read"] is True

    assert assistant_client.post(f"{_AVISOS}/read-all").status_code == 204
    assert assistant_client.get(_AVISOS).json()["unread"] == 0


def test_otro_despacho_no_ve_los_avisos(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, "abogado.uno@example.com", "lawyer")
    other = crear_oficina(db, nombre="Ajena")
    lawyer_client = _session(dispositivo, db, lawyer)
    case_id = lawyer_client.post(_CASES, json={"title": "Caso con aviso"}).json()["id"]
    lawyer_client.post(f"{_CASES}/{case_id}/members", json={"user_id": str(office.owner.id)})

    outsider = _session(dispositivo, db, other.owner)

    assert outsider.get(_AVISOS).json() == {"items": [], "unread": 0}
    assert outsider.post(f"{_AVISOS}/{uuid.uuid7()}/read").status_code == 404


def test_el_mantenimiento_borra_los_avisos_viejos(owner_db: Session) -> None:
    from sqlalchemy import func, insert, select

    from app.models import Notification
    from app.services import inbox

    office = crear_oficina(owner_db)
    ahora = datetime.datetime.now(datetime.UTC)
    dia = datetime.timedelta(days=1)

    def aviso(creado: datetime.datetime, leido: datetime.datetime | None) -> dict[str, Any]:
        return {
            "id": uuid.uuid7(),
            "organization_id": office.organization_id,
            "user_id": office.owner.id,
            "kind": "member_joined",
            "title": "Alguien entró al despacho",
            "link": "/app/miembros",
            "created_at": creado,
            "read_at": leido,
        }

    owner_db.execute(
        insert(Notification),
        [
            aviso(ahora - 100 * dia, ahora - 95 * dia),  # leído hace más de 90 días
            aviso(ahora - 100 * dia, None),  # sin leer, todavía no cumple el año
            aviso(ahora - 400 * dia, None),  # más de un año
            aviso(ahora - 2 * dia, ahora - dia),  # reciente
        ],
    )

    assert inbox.purge_old(owner_db) == 2
    assert owner_db.scalar(select(func.count()).select_from(Notification)) == 2
