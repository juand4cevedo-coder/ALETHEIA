"""Los nuevos paneles respetan la identidad de plataforma y las solicitudes tienen dueño."""

import datetime
import uuid

from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.core.legal import LEGAL_VERSION
from app.db.tenancy import set_tenant
from app.models import AuditLog, SupportTicket, User
from app.services.sessions import Principal
from tests.conftest import NuevoCliente, create_tenant


def _user(session: Session, email: str, *, platform_admin: bool = False) -> User:
    now = datetime.datetime.now(datetime.UTC)
    user = User(
        email=email,
        full_name="Persona de prueba",
        email_verified_at=now,
        is_platform_admin=platform_admin,
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=now,
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


def test_los_paneles_de_plataforma_rechazan_cuentas_ordinarias(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    user = _user(owner_db, "ordinary@example.com")
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(user)
    client = dispositivo()
    for path in (
        "/api/v1/platform/billing",
        "/api/v1/platform/audit",
        "/api/v1/platform/support/tickets",
    ):
        assert client.get(path).status_code == 403


def test_facturacion_y_auditoria_solo_exponen_el_resumen_y_eventos(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "owner@example.com", platform_admin=True)
    owner_db.add(
        AuditLog(
            organization_id=None,
            actor_user_id=admin.id,
            action="login",
            target_id=None,
            ip=None,
            user_agent=None,
        )
    )
    owner_db.flush()
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(admin)
    client = dispositivo()
    billing = client.get("/api/v1/platform/billing")
    assert billing.status_code == 200
    assert billing.headers["Cache-Control"] == "no-store"
    assert billing.json()["plans"]
    assert "payload" not in billing.text
    audit = client.get("/api/v1/platform/audit")
    assert audit.status_code == 200
    assert any(item["action"] == "login" for item in audit.json()["items"])
    assert "ip" not in audit.text
    assert "user_agent" not in audit.text


def test_solicitud_de_soporte_y_resolucion_dejan_auditoria(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    user = _user(owner_db, "client@example.com")
    admin = _user(owner_db, "owner@example.com", platform_admin=True)
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(user)
    client = dispositivo()
    invalid = client.post("/api/v1/support/tickets", json={"subject": "Corto", "message": "   "})
    assert invalid.status_code == 422
    created = client.post(
        "/api/v1/support/tickets",
        json={
            "subject": "Duda sobre acceso",
            "message": "Necesito revisar el ingreso a mi cuenta.",
        },
    )
    assert created.status_code == 201
    ticket_id = created.json()["id"]
    assert created.json()["status"] == "open"
    own = client.get("/api/v1/support/tickets")
    assert [item["id"] for item in own.json()["items"]] == [ticket_id]
    assert client.get("/api/v1/platform/support/tickets").status_code == 403
    app.dependency_overrides[get_principal] = lambda: _principal(admin)
    listed = client.get("/api/v1/platform/support/tickets")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["user_email"] == user.email
    changed = client.patch(
        f"/api/v1/platform/support/tickets/{ticket_id}/status", json={"status": "closed"}
    )
    assert changed.status_code == 200
    assert changed.json()["closed_at"] is not None
    actions = owner_db.scalars(
        select(AuditLog.action).where(AuditLog.target_id == uuid.UUID(ticket_id))
    ).all()
    assert set(actions) == {"support_ticket_opened", "support_ticket_closed"}


def test_cada_cuenta_solo_lee_sus_solicitudes_en_rls(db: Session) -> None:
    first = create_tenant(db, "Primera")
    db.add(
        SupportTicket(
            user_id=first.user_id,
            organization_id=first.organization_id,
            subject="Consulta primera",
            message="Necesito ayuda con mi cuenta.",
        )
    )
    db.flush()
    second = create_tenant(db, "Segunda")
    db.add(
        SupportTicket(
            user_id=second.user_id,
            organization_id=second.organization_id,
            subject="Consulta segunda",
            message="Necesito ayuda con el ingreso.",
        )
    )
    db.flush()
    assert [ticket.user_id for ticket in db.scalars(select(SupportTicket)).all()] == [
        second.user_id
    ]
    set_tenant(db, first.context)
    assert [ticket.user_id for ticket in db.scalars(select(SupportTicket)).all()] == [first.user_id]
