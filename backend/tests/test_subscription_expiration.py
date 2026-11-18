"""Vencimiento idempotente de pruebas y cortesías, con renovación segura."""

import datetime
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Job, Organization, Subscription
from app.services import subscription_expiration
from tests.organizations import crear_oficina


def _subscription(db: Session, organization_id: uuid.UUID) -> Subscription:
    return db.scalars(
        select(Subscription).where(Subscription.organization_id == organization_id)
    ).one()


def test_prueba_vencida_pasa_a_solo_lectura_una_sola_vez(db: Session) -> None:
    office = crear_oficina(db)
    now = datetime.datetime.now(datetime.UTC)
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = _subscription(db, office.organization_id)
    subscription.status = "trial"
    subscription.billing_cycle = "none"
    subscription.trial_ends_at = now - datetime.timedelta(seconds=1)
    db.flush()

    assert subscription_expiration.expire(db, office.organization_id, now)
    assert not subscription_expiration.expire(db, office.organization_id, now)
    assert subscription.status == "expired"
    assert db.get_one(Organization, office.organization_id).status == "read_only"
    assert (
        db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.action == "subscription_expired")
        )
        == 1
    )


def test_una_renovacion_futura_no_vencen_por_una_tarea_antigua(db: Session) -> None:
    office = crear_oficina(db)
    now = datetime.datetime.now(datetime.UTC)
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = _subscription(db, office.organization_id)
    subscription.status = "trial"
    subscription.billing_cycle = "none"
    subscription.trial_ends_at = now + datetime.timedelta(days=10)
    db.flush()

    assert not subscription_expiration.expire(db, office.organization_id, now)
    assert subscription.status == "trial"
    assert db.get_one(Organization, office.organization_id).status == "active"
    job = db.scalars(select(Job).where(Job.kind == "subscription_expire")).one()
    assert job.run_after == subscription.trial_ends_at


def test_un_periodo_pagado_vence_si_nadie_vuelve_a_pagar(db: Session) -> None:
    office = crear_oficina(db)  # ya queda active/monthly/legacy
    now = datetime.datetime.now(datetime.UTC)
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = _subscription(db, office.organization_id)
    subscription.access_source = "payment"
    subscription.current_period_end = now - datetime.timedelta(seconds=1)
    db.flush()

    assert subscription_expiration.expire(db, office.organization_id, now)
    assert subscription.status == "expired"
    assert db.get_one(Organization, office.organization_id).status == "read_only"


def test_un_periodo_pagado_que_no_vence_todavia_no_se_toca(db: Session) -> None:
    office = crear_oficina(db)
    now = datetime.datetime.now(datetime.UTC)
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = _subscription(db, office.organization_id)
    subscription.access_source = "payment"
    subscription.current_period_end = now + datetime.timedelta(days=5)
    db.flush()

    assert not subscription_expiration.expire(db, office.organization_id, now)
    assert subscription.status == "active"


def test_una_suscripcion_legacy_activa_no_vence_por_este_camino(db: Session) -> None:
    office = crear_oficina(db)  # access_source queda en "legacy", no "payment"
    now = datetime.datetime.now(datetime.UTC)

    assert not subscription_expiration.expire(db, office.organization_id, now)


def test_cortesia_con_fecha_vence_y_sin_fecha_sigue_activa(db: Session) -> None:
    office = crear_oficina(db)
    now = datetime.datetime.now(datetime.UTC)
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = _subscription(db, office.organization_id)
    subscription.billing_cycle = "none"
    subscription.courtesy_ends_at = None
    db.flush()
    assert not subscription_expiration.expire(db, office.organization_id, now)
    subscription.courtesy_ends_at = now - datetime.timedelta(seconds=1)
    db.flush()

    assert subscription_expiration.expire(db, office.organization_id, now)
    assert subscription.status == "expired"
    assert db.get_one(Organization, office.organization_id).status == "read_only"
