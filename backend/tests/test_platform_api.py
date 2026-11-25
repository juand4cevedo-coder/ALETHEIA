"""La administración de cuentas exige el atributo de plataforma y deja auditoría."""

import datetime
import uuid

from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.core.legal import LEGAL_VERSION
from app.models import AuditLog, User
from app.services.sessions import Principal
from tests.conftest import NuevoCliente


def _user(session: Session, email: str, *, platform_admin: bool = False) -> User:
    user = User(
        email=email,
        full_name="Cuenta de prueba",
        email_verified_at=datetime.datetime.now(datetime.UTC),
        is_platform_admin=platform_admin,
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
    )
    session.add(user)
    session.flush()
    return user


def _principal(user: User) -> Principal:
    return Principal(
        user_id=user.id,
        session_id=uuid.uuid7(),
        organization_id=None,
        role=None,
        legal_version=LEGAL_VERSION,
    )


def test_solo_la_cuenta_de_plataforma_ve_las_cuentas(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "admin@example.com", platform_admin=True)
    other = _user(owner_db, "other@example.com")
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(other)
    client = dispositivo()
    assert client.get("/api/v1/platform/users").status_code == 403
    app.dependency_overrides[get_principal] = lambda: _principal(admin)
    response = client.get("/api/v1/platform/users")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert {item["email"] for item in response.json()["items"]} == {
        "admin@example.com",
        "other@example.com",
    }
    assert response.json()["total"] == 2


def test_la_cuenta_de_plataforma_busca_y_filtra_cuentas_en_el_servidor(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "admin@example.com", platform_admin=True)
    admin.full_name = "Administradora ALETHEIA"
    blocked = _user(owner_db, "blocked@example.com")
    blocked.full_name = "Carlos Gómez"
    blocked.status = "blocked"
    pending = _user(owner_db, "pending@example.com")
    pending.full_name = "Carolina Torres"
    pending.email_verified_at = None
    _user(owner_db, "other@example.com")
    owner_db.flush()
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(admin)
    client = dispositivo()

    by_name = client.get("/api/v1/platform/users", params={"search": "cAr"})
    assert by_name.status_code == 200, by_name.text
    assert {item["email"] for item in by_name.json()["items"]} == {
        "blocked@example.com",
        "pending@example.com",
    }
    assert by_name.json()["total"] == 2

    filtered = client.get(
        "/api/v1/platform/users",
        params={
            "status": "blocked",
            "email_verified": "true",
            "platform_admin": "false",
        },
    )
    assert filtered.status_code == 200, filtered.text
    assert [item["email"] for item in filtered.json()["items"]] == ["blocked@example.com"]
    assert filtered.json()["total"] == 1

    literal_wildcard = client.get("/api/v1/platform/users", params={"search": "%"})
    assert literal_wildcard.status_code == 200, literal_wildcard.text
    assert literal_wildcard.json()["items"] == []
    assert literal_wildcard.json()["total"] == 0
    assert client.get("/api/v1/platform/users", params={"search": "   "}).status_code == 422
    assert client.get("/api/v1/platform/users", params={"status": "deleted"}).status_code == 422


def test_bloquear_cuenta_deja_constancia_y_protege_a_la_administradora(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "admin@example.com", platform_admin=True)
    other = _user(owner_db, "other@example.com")
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(admin)
    client = dispositivo()
    route = f"/api/v1/platform/users/{other.id}/status"
    assert client.patch(route, json={"status": "blocked"}).status_code == 200
    assert other.status == "blocked"
    audit = owner_db.scalars(select(AuditLog).where(AuditLog.action == "account_blocked")).all()
    assert len(audit) == 1
    assert audit[0].actor_user_id == admin.id
    assert audit[0].target_id == other.id
    assert client.patch(route, json={"status": "blocked"}).status_code == 200
    assert (
        len(owner_db.scalars(select(AuditLog).where(AuditLog.action == "account_blocked")).all())
        == 1
    )
    assert (
        client.patch(
            f"/api/v1/platform/users/{admin.id}/status", json={"status": "blocked"}
        ).status_code
        == 409
    )
