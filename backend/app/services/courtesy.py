"""Concesiones de cortesía para la cuenta propietaria de plataforma."""

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Membership, Organization, Plan, Subscription, User
from app.services import subscription_expiration
from app.services.audit import audit_ip


class AccountNotFound(Exception):
    pass


class CourtesyConflict(Exception):
    pass


@dataclass(frozen=True, slots=True)
class CourtesyView:
    organization_id: uuid.UUID
    organization_name: str
    account_email: str
    account_name: str
    plan_code: str
    status: str
    access_source: str
    ends_at: datetime.datetime | None
    granted_at: datetime.datetime | None
    revoked_at: datetime.datetime | None


def _account(session: Session, admin_id: uuid.UUID, email: str) -> tuple[User, uuid.UUID]:
    set_tenant(session, TenantContext(user_id=admin_id))
    row = session.execute(
        select(User, Membership.organization_id)
        .join(Membership, Membership.user_id == User.id)
        .where(func.lower(User.email) == email.strip().lower())
    ).one_or_none()
    if row is None:
        raise AccountNotFound
    return row[0], row[1]


def _view(session: Session, account: User, organization_id: uuid.UUID) -> CourtesyView:
    set_tenant(session, TenantContext(organization_id, account.id))
    row = session.execute(
        select(Organization, Subscription, Plan.code)
        .join(Subscription, Subscription.organization_id == Organization.id)
        .join(Plan, Plan.id == Subscription.plan_id)
        .where(Organization.id == organization_id)
    ).one_or_none()
    if row is None:
        raise AccountNotFound
    organization, subscription, plan_code = row
    return CourtesyView(
        organization_id=organization.id,
        organization_name=organization.name,
        account_email=account.email,
        account_name=account.full_name,
        plan_code=plan_code,
        status=subscription.status,
        access_source=subscription.access_source,
        ends_at=subscription.courtesy_ends_at
        if subscription.access_source == "courtesy"
        else subscription.trial_ends_at
        if subscription.access_source == "trial"
        else subscription.current_period_end,
        granted_at=subscription.courtesy_granted_at,
        revoked_at=subscription.courtesy_revoked_at,
    )


def lookup(session: Session, admin_id: uuid.UUID, email: str) -> CourtesyView:
    account, organization_id = _account(session, admin_id, email)
    return _view(session, account, organization_id)


def _admin_locked(session: Session, admin_id: uuid.UUID) -> None:
    set_tenant(session, TenantContext(user_id=admin_id))
    if (
        session.scalar(
            select(User.is_platform_admin).where(User.id == admin_id).with_for_update(read=True)
        )
        is not True
    ):
        raise PermissionError


def _target_locked(
    session: Session, admin_id: uuid.UUID, account_email: str, organization_id: uuid.UUID
) -> tuple[User, Organization, Subscription]:
    account, actual_id = _account(session, admin_id, account_email)
    if actual_id != organization_id:
        raise AccountNotFound
    set_tenant(session, TenantContext(organization_id, admin_id))
    organization = session.scalar(
        select(Organization).where(Organization.id == organization_id).with_for_update()
    )
    subscription = session.scalar(
        select(Subscription)
        .where(Subscription.organization_id == organization_id)
        .with_for_update()
    )
    if organization is None or subscription is None:
        raise AccountNotFound
    return account, organization, subscription


def grant(
    session: Session,
    admin_id: uuid.UUID,
    organization_id: uuid.UUID,
    account_email: str,
    plan_code: str,
    reason: str,
    ends_at: datetime.datetime | None,
    client_ip: str,
) -> CourtesyView:
    if not 10 <= len(reason) <= 500:
        raise CourtesyConflict
    session.commit()  # La lectura de autenticación termina antes de la escritura.
    with session.begin():
        _admin_locked(session, admin_id)
        account, organization, subscription = _target_locked(
            session, admin_id, account_email, organization_id
        )
        if organization.status == "suspended" or subscription.gateway_subscription_id is not None:
            raise CourtesyConflict
        plan = session.scalar(select(Plan).where(Plan.code == plan_code))
        if plan is None or plan.code == "trial":
            raise CourtesyConflict
        now = session.scalar(select(func.now()))
        if now is None or (ends_at is not None and ends_at <= now):
            raise CourtesyConflict
        action = (
            "courtesy_renewed" if subscription.access_source == "courtesy" else "courtesy_granted"
        )
        subscription.plan_id = plan.id
        subscription.status = "active"
        subscription.billing_cycle = "none"
        subscription.access_source = "courtesy"
        subscription.gateway_subscription_id = None
        subscription.current_period_end = None
        subscription.read_only_until = None
        subscription.courtesy_ends_at = ends_at
        subscription.courtesy_reason = reason
        subscription.courtesy_granted_by = admin_id
        subscription.courtesy_granted_at = now
        subscription.courtesy_revoked_at = None
        organization.status = "active"
        if ends_at is not None:
            subscription_expiration.schedule(session, organization_id, ends_at)
        session.add(
            AuditLog(
                organization_id=organization_id,
                actor_user_id=admin_id,
                action=action,
                target_id=subscription.id,
                details={
                    "plan_code": plan_code,
                    "reason": reason,
                    "ends_at": ends_at.isoformat() if ends_at else None,
                },
                ip=audit_ip(client_ip),
                user_agent=None,
                created_at=now,
            )
        )
        return _view(session, account, organization_id)


def revoke(
    session: Session,
    admin_id: uuid.UUID,
    organization_id: uuid.UUID,
    account_email: str,
    reason: str,
    client_ip: str,
) -> CourtesyView:
    if not 10 <= len(reason) <= 500:
        raise CourtesyConflict
    session.commit()
    with session.begin():
        _admin_locked(session, admin_id)
        account, organization, subscription = _target_locked(
            session, admin_id, account_email, organization_id
        )
        if subscription.access_source != "courtesy" or subscription.status != "active":
            raise CourtesyConflict
        now = session.scalar(select(func.now()))
        if now is None:
            raise RuntimeError("La base no devolvió la fecha actual.")
        subscription.status = "canceled"
        subscription.courtesy_revoked_at = now
        if organization.status == "active":
            organization.status = "read_only"
        session.add(
            AuditLog(
                organization_id=organization_id,
                actor_user_id=admin_id,
                action="courtesy_revoked",
                target_id=subscription.id,
                details={
                    "plan_code": session.scalar(
                        select(Plan.code).where(Plan.id == subscription.plan_id)
                    ),
                    "reason": reason,
                    "ends_at": subscription.courtesy_ends_at.isoformat()
                    if subscription.courtesy_ends_at
                    else None,
                },
                ip=audit_ip(client_ip),
                user_agent=None,
                created_at=now,
            )
        )
        return _view(session, account, organization_id)
