"""Agenda y aplica el vencimiento de pruebas y cortesías sin revocar renovaciones."""

import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Job, Organization, Subscription


def schedule(session: Session, organization_id: uuid.UUID, deadline: datetime.datetime) -> None:
    """Una tarea por fecha; la renovación puede encolar otra sin cambiar la anterior."""
    stamp = int(deadline.timestamp() * 1_000_000)
    session.execute(
        insert(Job)
        .values(
            kind="subscription_expire",
            payload={"organization_id": str(organization_id)},
            idempotency_key=f"subscription_expire:{organization_id}:{stamp}",
            run_after=deadline,
        )
        .on_conflict_do_nothing(index_elements=[Job.idempotency_key])
    )


def expire(session: Session, organization_id: uuid.UUID, now: datetime.datetime) -> bool:
    """Cambia ambos estados y audita en una transacción que aporta el llamante."""
    set_tenant(session, TenantContext(organization_id=organization_id))
    # Las cargas e invitaciones bloquean primero la organización. Respetar ese orden evita
    # un interbloqueo al vencer una suscripción durante una escritura.
    organization = session.scalar(
        select(Organization).where(Organization.id == organization_id).with_for_update()
    )
    if organization is None:
        return False
    subscription = session.scalar(
        select(Subscription)
        .where(Subscription.organization_id == organization_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if subscription is None:
        return False
    if subscription.status == "trial":
        deadline = subscription.trial_ends_at
    elif subscription.status == "active" and subscription.billing_cycle == "none":
        deadline = subscription.courtesy_ends_at
    else:
        return False
    if deadline is None:
        return False
    if deadline > now:
        schedule(session, organization_id, deadline)
        return False

    subscription.status = "expired"
    if organization.status == "active":
        organization.status = "read_only"
    session.add(
        AuditLog(
            organization_id=organization_id,
            actor_user_id=None,
            action="subscription_expired",
            target_id=subscription.id,
            ip=None,
            user_agent=None,
            created_at=now,
        )
    )
    return True
