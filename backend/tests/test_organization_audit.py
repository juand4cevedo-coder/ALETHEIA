"""HU-014: la auditoría de seguridad se limita al despacho y a sus gestores."""

import datetime
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, User
from app.schemas.organization import OrganizationAuditAction
from app.services.organization_audit import SECURITY_ACTIONS
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, crear_miembro, crear_oficina

PATH = "/api/v1/organization/audit"


def test_el_filtro_expone_exactamente_las_acciones_de_seguridad() -> None:
    assert {action.value for action in OrganizationAuditAction} == set(SECURITY_ACTIONS)


def _login(dispositivo: NuevoCliente, user: User) -> TestClient:
    client = dispositivo()
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": CLAVE})
    assert response.status_code == 204, response.text
    return client


def test_solo_gestores_ven_eventos_de_su_despacho_sin_contenido(
    dispositivo: NuevoCliente, db: Session
) -> None:
    first = crear_oficina(db)
    admin = crear_miembro(db, first, "admin-audit@example.com", "admin")
    lawyer = crear_miembro(db, first, "lawyer-audit@example.com", "lawyer")
    second = crear_oficina(db)

    set_tenant(db, TenantContext(organization_id=first.organization_id, user_id=first.owner.id))
    own_ids = [uuid.uuid7() for _ in range(3)]
    for event_id, action in zip(own_ids, ("login", "role_changed", "plan_changed"), strict=True):
        db.add(
            AuditLog(
                id=event_id,
                organization_id=first.organization_id,
                actor_user_id=first.owner.id,
                action=action,
                target_id=lawyer.id,
                ip="192.0.2.10",
                user_agent="Navegador de prueba",
                details={"private": "no publicar"},
            )
        )
    db.add(
        AuditLog(
            organization_id=first.organization_id,
            actor_user_id=first.owner.id,
            action="case_created",
            target_id=uuid.uuid7(),
        )
    )
    db.flush()
    set_tenant(db, TenantContext(organization_id=second.organization_id, user_id=second.owner.id))
    foreign_event = AuditLog(
        organization_id=second.organization_id,
        actor_user_id=second.owner.id,
        action="plan_changed",
    )
    db.add(foreign_event)
    db.flush()
    foreign_event_id = foreign_event.id

    owner_client = _login(dispositivo, first.owner)
    response = owner_client.get(PATH)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    page = response.json()
    assert {str(event_id) for event_id in own_ids} <= {event["id"] for event in page["items"]}
    assert str(foreign_event_id) not in {event["id"] for event in page["items"]}
    assert all(event["action"] != "case_created" for event in page["items"])
    assert all("details" not in event and "organization_id" not in event for event in page["items"])
    assert "no publicar" not in response.text
    assert (
        next(event for event in page["items"] if event["id"] == str(own_ids[0]))["ip"]
        == "192.0.2.10"
    )

    admin_client = _login(dispositivo, admin)
    assert admin_client.get(PATH).status_code == 200
    lawyer_client = _login(dispositivo, lawyer)
    assert lawyer_client.get(PATH).status_code == 403


def test_auditoria_paginas_y_limita_el_tamano(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    client = _login(dispositivo, office.owner)
    for _ in range(4):
        db.add(
            AuditLog(
                organization_id=office.organization_id,
                actor_user_id=office.owner.id,
                action="login",
            )
        )
    db.flush()
    first = client.get(PATH, params={"limit": 2})
    assert first.status_code == 200
    cursor = first.json()["next_cursor"]
    assert cursor is not None
    second = client.get(PATH, params={"limit": 2, "cursor": cursor})
    assert second.status_code == 200
    assert not (
        {row["id"] for row in first.json()["items"]} & {row["id"] for row in second.json()["items"]}
    )
    assert client.get(PATH, params={"limit": 101}).status_code == 422


def test_auditoria_filtra_en_el_servidor_por_accion_persona_y_periodo(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    admin = crear_miembro(db, office, "admin-filtros@example.com", "admin")
    client = _login(dispositivo, office.owner)
    start = datetime.datetime(2026, 11, 10, tzinfo=datetime.UTC)
    for offset, action, actor in (
        (0, "login", office.owner.id),
        (1, "role_changed", admin.id),
        (2, "role_changed", office.owner.id),
    ):
        db.add(
            AuditLog(
                organization_id=office.organization_id,
                actor_user_id=actor,
                action=action,
                created_at=start + datetime.timedelta(days=offset),
            )
        )
    db.flush()

    response = client.get(
        PATH,
        params={
            "action": "role_changed",
            "actor": str(admin.id),
            "created_from": "2026-11-10T00:00:00Z",
            "created_to": "2026-11-12T00:00:00Z",
        },
    )

    assert response.status_code == 200, response.text
    assert [(item["action"], item["actor_user_id"]) for item in response.json()["items"]] == [
        ("role_changed", str(admin.id))
    ]
    assert client.get(PATH, params={"action": "case_created"}).status_code == 422
    assert (
        client.get(
            PATH,
            params={
                "created_from": "2026-11-12T00:00:00Z",
                "created_to": "2026-11-10T00:00:00Z",
            },
        ).status_code
        == 422
    )


EXPORT_PATH = "/api/v1/organization/audit/export"


def test_el_gestor_exporta_su_auditoria_a_csv_sin_datos_internos(
    dispositivo: NuevoCliente, db: Session
) -> None:
    first = crear_oficina(db)
    lawyer = crear_miembro(db, first, "lawyer-csv@example.com", "lawyer")
    second = crear_oficina(db)

    set_tenant(db, TenantContext(organization_id=first.organization_id, user_id=first.owner.id))
    db.add(
        AuditLog(
            organization_id=first.organization_id,
            actor_user_id=first.owner.id,
            action="role_changed",
            target_id=lawyer.id,
            ip="192.0.2.10",
            user_agent="=HYPERLINK(1)",
            details={"private": "no publicar"},
        )
    )
    db.add(
        AuditLog(
            organization_id=first.organization_id,
            actor_user_id=first.owner.id,
            action="case_created",
            target_id=uuid.uuid7(),
        )
    )
    db.flush()
    set_tenant(db, TenantContext(organization_id=second.organization_id, user_id=second.owner.id))
    db.add(
        AuditLog(
            organization_id=second.organization_id,
            actor_user_id=second.owner.id,
            action="plan_changed",
            user_agent="Otro despacho",
        )
    )
    db.flush()

    response = _login(dispositivo, first.owner).get(EXPORT_PATH)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-rows-truncated"] == "0"
    assert response.headers["content-disposition"].startswith("attachment; filename=")
    lines = response.text.splitlines()
    assert lines[0] == "fecha_utc,accion,persona_id,objeto_id,ip,navegador"
    body = "\n".join(lines[1:])
    assert "role_changed" in body
    # La hoja de cálculo no debe ejecutar como fórmula lo que escribió un navegador.
    assert "'=HYPERLINK(1)" in body
    assert "case_created" not in body
    assert "Otro despacho" not in body
    assert "no publicar" not in response.text


def test_la_exportacion_respeta_el_filtro_de_accion(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    for action in ("login", "plan_changed"):
        db.add(
            AuditLog(
                organization_id=office.organization_id,
                actor_user_id=office.owner.id,
                action=action,
            )
        )
    db.flush()

    response = _login(dispositivo, office.owner).get(EXPORT_PATH, params={"action": "plan_changed"})
    assert response.status_code == 200, response.text
    rows = response.text.splitlines()[1:]
    assert rows
    assert all(",plan_changed," in row for row in rows)


def test_solo_los_gestores_exportan_la_auditoria(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, "lawyer-sin-csv@example.com", "lawyer")

    assert dispositivo().get(EXPORT_PATH).status_code == 401
    assert _login(dispositivo, lawyer).get(EXPORT_PATH).status_code == 403


def test_la_exportacion_exige_periodos_con_zona_horaria(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _login(dispositivo, office.owner)

    naive = client.get(EXPORT_PATH, params={"created_from": "2026-11-01T00:00:00"})
    assert naive.status_code == 422
    inverted = client.get(
        EXPORT_PATH,
        params={
            "created_from": "2026-12-01T00:00:00+00:00",
            "created_to": "2026-11-01T00:00:00+00:00",
        },
    )
    assert inverted.status_code == 422
