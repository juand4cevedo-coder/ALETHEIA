"""Tareas y plazos diferenciados por rol dentro de un caso."""

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


def test_abogado_asigna_y_asistente_ejecuta_su_tarea(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, "abogada.tareas@example.com", "lawyer")
    assistant = crear_miembro(db, office, "asistente.tareas@example.com", "assistant")
    lawyer_client = _session(dispositivo, db, lawyer)
    created_case = lawyer_client.post(_CASES, json={"title": "Sucesión con plazo"})
    assert created_case.status_code == 201, created_case.text
    case_id = created_case.json()["id"]
    added = lawyer_client.post(f"{_CASES}/{case_id}/members", json={"user_id": str(assistant.id)})
    assert added.status_code == 204, added.text

    created_task = lawyer_client.post(
        f"{_CASES}/{case_id}/tasks",
        json={
            "title": "Preparar cronología procesal",
            "description": "Ordenar las actuaciones antes de la reunión.",
            "priority": "high",
            "due_at": "2026-11-24T17:00:00-05:00",
            "assigned_to": str(assistant.id),
        },
    )
    assert created_task.status_code == 201, created_task.text
    task = created_task.json()
    assert task["status"] == "pending"
    assert task["assignee_name"] == assistant.full_name
    assert created_task.headers["Cache-Control"] == "no-store"

    assistant_client = _session(dispositivo, db, assistant)
    listed = assistant_client.get(
        f"{_CASES}/{case_id}/tasks",
        params={"search": "cronología", "assigned_to": str(assistant.id)},
    )
    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()["items"]] == [task["id"]]

    completed = assistant_client.patch(
        f"{_CASES}/{case_id}/tasks/{task['id']}/status",
        json={"status": "completed"},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"] is not None
    filtered = assistant_client.get(f"{_CASES}/{case_id}/tasks", params={"status": "completed"})
    assert [item["id"] for item in filtered.json()["items"]] == [task["id"]]

    actions = db.scalars(select(AuditLog.action).where(AuditLog.target_id == task["id"])).all()
    assert actions == ["case_task_created", "case_task_status_changed"]


def test_asistente_no_crea_cancela_ni_actualiza_tareas_ajenas(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    assistant = crear_miembro(db, office, "asistente.limites@example.com", "assistant")
    owner_client = _session(dispositivo, db, office.owner)
    case_id = owner_client.post(_CASES, json={"title": "Caso de límites"}).json()["id"]
    owner_client.post(f"{_CASES}/{case_id}/members", json={"user_id": str(assistant.id)})
    own_task = owner_client.post(
        f"{_CASES}/{case_id}/tasks",
        json={
            "title": "Revisar estrategia",
            "priority": "normal",
            "assigned_to": str(office.owner.id),
        },
    ).json()
    assistant_task = owner_client.post(
        f"{_CASES}/{case_id}/tasks",
        json={
            "title": "Organizar anexos",
            "priority": "normal",
            "assigned_to": str(assistant.id),
        },
    ).json()
    assistant_client = _session(dispositivo, db, assistant)

    assert (
        assistant_client.post(
            f"{_CASES}/{case_id}/tasks",
            json={
                "title": "No autorizada",
                "priority": "low",
                "assigned_to": str(assistant.id),
            },
        ).status_code
        == 403
    )
    assert (
        assistant_client.patch(
            f"{_CASES}/{case_id}/tasks/{own_task['id']}/status",
            json={"status": "completed"},
        ).status_code
        == 404
    )
    assert (
        assistant_client.patch(
            f"{_CASES}/{case_id}/tasks/{assistant_task['id']}/status",
            json={"status": "canceled"},
        ).status_code
        == 403
    )


def test_un_caso_archivado_conserva_tareas_en_solo_lectura(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    case_id = client.post(_CASES, json={"title": "Caso por archivar"}).json()["id"]
    task = client.post(
        f"{_CASES}/{case_id}/tasks",
        json={
            "title": "Tarea preservada",
            "priority": "urgent",
            "assigned_to": str(office.owner.id),
        },
    ).json()
    assert client.post(f"{_CASES}/{case_id}/close").status_code == 200

    assert client.get(f"{_CASES}/{case_id}/tasks").json()["items"][0]["id"] == task["id"]
    assert (
        client.patch(
            f"{_CASES}/{case_id}/tasks/{task['id']}/status",
            json={"status": "completed"},
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"{_CASES}/{case_id}/tasks",
            json={
                "title": "Tarea posterior",
                "priority": "normal",
                "assigned_to": str(office.owner.id),
            },
        ).status_code
        == 409
    )
