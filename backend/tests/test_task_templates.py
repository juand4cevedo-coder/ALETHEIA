"""Plantillas de tareas: permisos, aislamiento por despacho y creación de tareas en un caso."""

import datetime
import uuid
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, User
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina

_TEMPLATES = "/api/v1/task-templates"
_CASES = "/api/v1/cases"

_BODY = {
    "name": "Proceso laboral",
    "items": [
        {"title": "Radicar la demanda", "priority": "high", "due_days": 3},
        {"title": "Notificar al demandado", "due_days": 10},
        {"title": "Archivar soportes"},
    ],
}


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


def test_se_crea_se_lista_y_se_borra_una_plantilla(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)

    created = client.post(_TEMPLATES, json=_BODY)
    assert created.status_code == 201, created.text
    assert created.headers["cache-control"] == "no-store"
    body = created.json()
    assert [item["title"] for item in body["items"]] == [
        "Radicar la demanda",
        "Notificar al demandado",
        "Archivar soportes",
    ]
    assert body["items"][0]["due_days"] == 3
    assert body["items"][2]["due_days"] is None

    listed = client.get(_TEMPLATES).json()["items"]
    assert [template["name"] for template in listed] == ["Proceso laboral"]

    assert client.delete(f"{_TEMPLATES}/{body['id']}").status_code == 204
    assert client.get(_TEMPLATES).json()["items"] == []
    assert client.delete(f"{_TEMPLATES}/{body['id']}").status_code == 404


def test_el_nombre_se_repite_solo_en_otro_despacho(dispositivo: NuevoCliente, db: Session) -> None:
    first = crear_oficina(db)
    second = crear_oficina(db)
    first_client = _session(dispositivo, db, first.owner)
    second_client = _session(dispositivo, db, second.owner)

    assert first_client.post(_TEMPLATES, json=_BODY).status_code == 201
    assert first_client.post(_TEMPLATES, json=_BODY).status_code == 409
    assert second_client.post(_TEMPLATES, json=_BODY).status_code == 201
    # Cada despacho ve solo las suyas.
    assert len(second_client.get(_TEMPLATES).json()["items"]) == 1


def test_un_asistente_no_gestiona_plantillas_y_los_datos_se_validan(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    assistant = crear_miembro(db, office, "asistente-plantillas@example.com", "assistant")
    assistant_client = _session(dispositivo, db, assistant)

    assert assistant_client.get(_TEMPLATES).status_code == 403
    assert assistant_client.post(_TEMPLATES, json=_BODY).status_code == 403
    assert dispositivo().get(_TEMPLATES).status_code == 401

    client = _session(dispositivo, db, office.owner)
    for body in (
        {"name": "", "items": [{"title": "A"}]},
        {"name": "Vacía", "items": []},
        {"name": "Sin título", "items": [{"title": ""}]},
        {"name": "Plazo", "items": [{"title": "A", "due_days": 366}]},
        {"name": "Prioridad", "items": [{"title": "A", "priority": "maxima"}]},
        {"name": "Mucho", "items": [{"title": f"T{n}"} for n in range(31)]},
    ):
        assert client.post(_TEMPLATES, json=body).status_code == 422, body


def test_aplicar_una_plantilla_crea_las_tareas_con_su_plazo(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    template_id = client.post(_TEMPLATES, json=_BODY).json()["id"]
    case_id = client.post(_CASES, json={"title": "Caso con plantilla"}).json()["id"]

    applied = client.post(
        f"{_CASES}/{case_id}/tasks/from-template",
        json={"template_id": template_id, "assigned_to": str(office.owner.id)},
    )

    assert applied.status_code == 201, applied.text
    tasks = applied.json()["tasks"]
    assert [task["title"] for task in tasks] == [
        "Radicar la demanda",
        "Notificar al demandado",
        "Archivar soportes",
    ]
    assert tasks[0]["priority"] == "high"
    assert tasks[2]["due_at"] is None
    # Los plazos vencen a las 5 de la tarde de Colombia (22:00 UTC).
    assert datetime.datetime.fromisoformat(tasks[0]["due_at"]).hour == 22
    assert all(task["assigned_to"] == str(office.owner.id) for task in tasks)
    listed = client.get(f"{_CASES}/{case_id}/tasks").json()["items"]
    assert len(listed) == 3


def test_aplicar_falla_entera_si_el_caso_esta_archivado_o_la_persona_no_pertenece(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    outsider = crear_miembro(db, office, "fuera-del-caso@example.com", "lawyer")
    client = _session(dispositivo, db, office.owner)
    template_id = client.post(_TEMPLATES, json=_BODY).json()["id"]
    case_id = client.post(_CASES, json={"title": "Caso a archivar"}).json()["id"]

    # Alguien que no es miembro del caso no puede ser la persona responsable.
    not_member = client.post(
        f"{_CASES}/{case_id}/tasks/from-template",
        json={"template_id": template_id, "assigned_to": str(outsider.id)},
    )
    assert not_member.status_code == 404
    assert client.get(f"{_CASES}/{case_id}/tasks").json()["items"] == []

    assert client.post(f"{_CASES}/{case_id}/close").status_code == 200
    closed = client.post(
        f"{_CASES}/{case_id}/tasks/from-template",
        json={"template_id": template_id, "assigned_to": str(office.owner.id)},
    )
    assert closed.status_code == 409
    assert client.get(f"{_CASES}/{case_id}/tasks").json()["items"] == []


def test_no_se_aplica_la_plantilla_de_otro_despacho(dispositivo: NuevoCliente, db: Session) -> None:
    mine = crear_oficina(db)
    other = crear_oficina(db)
    other_client = _session(dispositivo, db, other.owner)
    foreign_id = other_client.post(_TEMPLATES, json=_BODY).json()["id"]
    client = _session(dispositivo, db, mine.owner)
    case_id = client.post(_CASES, json={"title": "Mi caso"}).json()["id"]

    response = client.post(
        f"{_CASES}/{case_id}/tasks/from-template",
        json={"template_id": foreign_id, "assigned_to": str(mine.owner.id)},
    )

    assert response.status_code == 404
    assert client.delete(f"{_TEMPLATES}/{foreign_id}").status_code == 404


def _audit_actions(db: Session, office: Oficina) -> list[str]:
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    return list(
        db.scalars(
            select(AuditLog.action)
            .where(
                AuditLog.organization_id == office.organization_id,
                AuditLog.action.like("task_template_%"),
            )
            .order_by(AuditLog.id)
        )
    )


def test_se_edita_una_plantilla_y_se_reemplazan_sus_tareas(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)
    template_id = client.post(_TEMPLATES, json=_BODY).json()["id"]
    case_id = client.post(_CASES, json={"title": "Caso previo"}).json()["id"]
    client.post(
        f"{_CASES}/{case_id}/tasks/from-template",
        json={"template_id": template_id, "assigned_to": str(office.owner.id)},
    )

    edited = client.put(
        f"{_TEMPLATES}/{template_id}",
        json={
            "name": "Proceso laboral actualizado",
            "items": [
                {"title": "Revisar poder", "priority": "urgent", "due_days": 1},
                {"title": "Radicar la demanda", "due_days": 5},
            ],
        },
    )

    assert edited.status_code == 200, edited.text
    assert edited.headers["cache-control"] == "no-store"
    body = edited.json()
    assert body["id"] == template_id
    assert body["name"] == "Proceso laboral actualizado"
    assert [item["title"] for item in body["items"]] == ["Revisar poder", "Radicar la demanda"]
    assert body["items"][0]["priority"] == "urgent"
    listed = client.get(_TEMPLATES).json()["items"]
    assert [template["name"] for template in listed] == ["Proceso laboral actualizado"]
    assert len(listed[0]["items"]) == 2
    # Las tareas ya creadas con la versión anterior no cambian.
    assert len(client.get(f"{_CASES}/{case_id}/tasks").json()["items"]) == 3
    # Y aplicar la plantilla ahora crea las dos nuevas.
    case_two = client.post(_CASES, json={"title": "Caso nuevo"}).json()["id"]
    applied = client.post(
        f"{_CASES}/{case_two}/tasks/from-template",
        json={"template_id": template_id, "assigned_to": str(office.owner.id)},
    )
    assert [task["title"] for task in applied.json()["tasks"]] == [
        "Revisar poder",
        "Radicar la demanda",
    ]


def test_editar_respeta_nombres_permisos_y_despachos(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    other = crear_oficina(db)
    assistant = crear_miembro(db, office, "asistente-edita@example.com", "assistant")
    client = _session(dispositivo, db, office.owner)
    first = client.post(_TEMPLATES, json=_BODY).json()["id"]
    second = client.post(
        _TEMPLATES, json={"name": "Otro proceso", "items": [{"title": "Una tarea"}]}
    ).json()["id"]

    # El mismo nombre de la propia plantilla se acepta; el de otra del despacho, no.
    same = client.put(f"{_TEMPLATES}/{first}", json=_BODY)
    assert same.status_code == 200, same.text
    taken = client.put(f"{_TEMPLATES}/{second}", json=_BODY)
    assert taken.status_code == 409
    # La plantilla de otro despacho no existe para quien edita.
    foreign = _session(dispositivo, db, other.owner)
    assert foreign.put(f"{_TEMPLATES}/{first}", json=_BODY).status_code == 404
    assert client.put(f"{_TEMPLATES}/{uuid.uuid4()}", json=_BODY).status_code == 404
    # Un asistente no edita, y los datos se validan igual que al crear.
    assert (
        _session(dispositivo, db, assistant).put(f"{_TEMPLATES}/{first}", json=_BODY).status_code
        == 403
    )
    assert (
        client.put(f"{_TEMPLATES}/{first}", json={"name": "Vacía", "items": []}).status_code == 422
    )
    assert dispositivo().put(f"{_TEMPLATES}/{first}", json=_BODY).status_code == 401


def test_crear_editar_y_borrar_dejan_rastro_en_la_auditoria(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _session(dispositivo, db, office.owner)

    template_id = client.post(_TEMPLATES, json=_BODY).json()["id"]
    client.put(
        f"{_TEMPLATES}/{template_id}",
        json={"name": "Renombrada", "items": [{"title": "Una tarea"}]},
    )
    client.delete(f"{_TEMPLATES}/{template_id}")

    assert _audit_actions(db, office) == [
        "task_template_created",
        "task_template_updated",
        "task_template_deleted",
    ]
