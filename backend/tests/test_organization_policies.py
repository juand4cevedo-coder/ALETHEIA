"""Políticas del despacho: quién las cambia, qué dejan en la auditoría y que se apliquen."""

import datetime

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Case, RefreshToken, User
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina

PATH = "/api/v1/organization/policies"


def _login(dispositivo: NuevoCliente, user: User, db: Session | None = None) -> TestClient:
    # Abrir casos exige el correo verificado; quien no necesita casos no toca la base.
    if db is not None:
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


def _events(db: Session, office: Oficina) -> list[AuditLog]:
    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    return list(
        db.scalars(
            select(AuditLog).where(
                AuditLog.organization_id == office.organization_id,
                AuditLog.action == "organization_policy_changed",
            )
        )
    )


def test_los_valores_por_omision_son_los_de_siempre(dispositivo: NuevoCliente, db: Session) -> None:
    office = crear_oficina(db)

    response = _login(dispositivo, office.owner).get(PATH)

    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"default_retention_years": 10, "session_days": 14}


def test_solo_el_propietario_cambia_las_politicas_y_queda_en_la_auditoria(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    admin = crear_miembro(db, office, "admin-politicas@example.com", "admin")
    lawyer = crear_miembro(db, office, "abogada-politicas@example.com", "lawyer")
    body = {"default_retention_years": 5, "session_days": 7}

    assert _login(dispositivo, lawyer).get(PATH).status_code == 403
    admin_client = _login(dispositivo, admin)
    assert admin_client.get(PATH).status_code == 200
    assert admin_client.put(PATH, json=body).status_code == 403
    assert dispositivo().put(PATH, json=body).status_code == 401

    owner_client = _login(dispositivo, office.owner)
    changed = owner_client.put(PATH, json=body)
    assert changed.status_code == 200, changed.text
    assert changed.json() == body
    assert owner_client.get(PATH).json() == body
    assert len(_events(db, office)) == 1

    # Repetir los mismos valores no deja otro evento.
    assert owner_client.put(PATH, json=body).status_code == 200
    assert len(_events(db, office)) == 1


def test_las_politicas_rechazan_valores_fuera_de_rango(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _login(dispositivo, office.owner)

    for body in (
        {"default_retention_years": 0, "session_days": 7},
        {"default_retention_years": 31, "session_days": 7},
        {"default_retention_years": 10, "session_days": 0},
        {"default_retention_years": 10, "session_days": 15},
        {"default_retention_years": 10},
        {"default_retention_years": 10, "session_days": 7, "extra": 1},
    ):
        assert client.put(PATH, json=body).status_code == 422, body


def test_un_caso_archivado_conserva_los_anos_de_la_politica(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    client = _login(dispositivo, office.owner, db)
    assert (
        client.put(PATH, json={"default_retention_years": 3, "session_days": 14}).status_code == 200
    )
    case_id = client.post("/api/v1/cases", json={"title": "Caso con política"}).json()["id"]

    assert client.post(f"/api/v1/cases/{case_id}/close").status_code == 200

    set_tenant(db, TenantContext(organization_id=office.organization_id, user_id=office.owner.id))
    case = db.scalars(select(Case).where(Case.id == case_id)).one()
    assert case.closed_at is not None
    assert case.retention_until is not None
    years = (case.retention_until - case.closed_at).days / 365.25
    assert 2.99 < years < 3.01


def test_una_sesion_nueva_dura_lo_que_dice_la_politica(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    assert (
        _login(dispositivo, office.owner)
        .put(PATH, json={"default_retention_years": 10, "session_days": 2})
        .status_code
        == 200
    )

    _login(dispositivo, office.owner)

    now = datetime.datetime.now(datetime.UTC)
    latest = db.scalars(
        select(RefreshToken)
        .where(RefreshToken.user_id == office.owner.id)
        .order_by(RefreshToken.expires_at.asc())
    ).first()
    assert latest is not None
    assert latest.expires_at - now < datetime.timedelta(days=2, minutes=5)
