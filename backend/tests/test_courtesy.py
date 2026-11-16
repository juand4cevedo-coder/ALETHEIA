"""La concesión de cortesías requiere propietario, destino exacto y auditoría."""

import datetime
import uuid

from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Job, Organization, Subscription
from app.services import subscription_expiration
from app.services.sessions import Principal
from tests.conftest import NuevoCliente
from tests.organizations import crear_oficina, crear_persona


def _principal(user_id: uuid.UUID) -> Principal:
    return Principal(
        user_id=user_id,
        session_id=uuid.uuid7(),
        organization_id=None,
        role=None,
        legal_version="2026-11-13",
    )


def test_conceder_renovar_y_revocar_sin_registrar_pago(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    db = owner_db
    office = crear_oficina(db)
    admin = crear_persona(db, f"platform-{uuid.uuid4().hex}@example.com")
    admin.is_platform_admin = True
    db.commit()
    app.dependency_overrides[get_session] = lambda: db
    app.dependency_overrides[get_principal] = lambda: _principal(admin.id)
    client = dispositivo()
    path = "/api/v1/platform/courtesy"
    found = client.get(path, params={"owner_email": office.owner.email})
    assert found.status_code == 200
    assert found.json()["organization_id"] == str(office.organization_id)
    assert "reason" not in found.text
    body = {
        "organization_id": str(office.organization_id),
        "owner_email": office.owner.email,
        "plan_code": "corporate",
        "reason": "Acceso de cortesía autorizado para evaluación",
        "ends_at": (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=7)).isoformat(),
    }
    wrong = client.post(path, json={**body, "organization_id": str(uuid.uuid7())})
    assert wrong.status_code == 404
    granted = client.post(path, json=body)
    assert granted.status_code == 200
    assert granted.json()["access_source"] == "courtesy"
    assert granted.json()["plan_code"] == "corporate"
    assert "reason" not in granted.text
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = db.scalar(
        select(Subscription).where(Subscription.organization_id == office.organization_id)
    )
    assert subscription is not None
    assert subscription.gateway_subscription_id is None
    assert subscription.courtesy_reason == body["reason"]
    assert db.scalars(select(Job).where(Job.kind == "subscription_expire")).one()
    set_tenant(db, TenantContext())
    renewed = client.post(path, json={**body, "ends_at": None, "plan_code": "essential"})
    assert renewed.status_code == 200
    assert renewed.json()["ends_at"] is None
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    assert not subscription_expiration.expire(
        db, office.organization_id, datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=8)
    )
    set_tenant(db, TenantContext())
    revoked = client.post(
        f"{path}/revoke",
        json={
            "organization_id": str(office.organization_id),
            "owner_email": office.owner.email,
            "reason": "Finalizó el periodo de cortesía acordado",
        },
    )
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "canceled"
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    assert db.get_one(Organization, office.organization_id).status == "read_only"
    actions = set(
        db.scalars(
            select(AuditLog.action).where(AuditLog.organization_id == office.organization_id)
        )
    )
    assert {"courtesy_granted", "courtesy_renewed", "courtesy_revoked"} <= actions


def test_cuenta_ordinaria_no_concede_cortesia(
    app: FastAPI, db: Session, dispositivo: NuevoCliente
) -> None:
    office = crear_oficina(db)
    db.commit()
    app.dependency_overrides[get_principal] = lambda: _principal(office.owner.id)
    client = dispositivo()
    assert (
        client.get(
            "/api/v1/platform/courtesy", params={"owner_email": office.owner.email}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/platform/courtesy",
            json={
                "organization_id": str(office.organization_id),
                "owner_email": office.owner.email,
                "plan_code": "essential",
                "reason": "Intento sin permiso suficiente",
            },
        ).status_code
        == 403
    )
