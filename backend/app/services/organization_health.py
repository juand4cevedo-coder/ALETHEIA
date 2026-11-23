"""Salud del despacho: lo que un gestor necesita ver de un vistazo, sin abrir ningún caso.

Solo usa datos de la propia organización que un gestor ya puede consultar: el plan y el
almacenamiento, el cupo de usuarios y los eventos de seguridad de los últimos siete días. No
cuenta casos ni tareas: esas tablas se filtran por pertenencia al caso y un conteo parcial
engañaría.
"""

import datetime
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, Organization, Subscription
from app.repositories import organization as organization_repository
from app.services import members as members_service
from app.services.sessions import Principal

WINDOW_DAYS = 7

# Qué acciones cuenta cada indicador de seguridad.
_INDICATORS = {
    "logins": ("login",),
    "failed_logins": ("login_failed",),
    "sessions_revoked": ("sessions_revoked", "session_reuse_detected"),
    "role_changes": ("role_changed", "member_removed"),
    "invitations": ("invitation_sent", "invitation_accepted"),
}


@dataclass(frozen=True)
class Health:
    storage_used_bytes: int
    storage_limit_bytes: int | None
    plan_name: str | None
    subscription_status: str | None
    subscription_ends_at: datetime.datetime | None
    members: int
    seats_included: int
    seats_used: int
    window_days: int
    indicators: dict[str, int]


def health(session: Session, principal: Principal, now: datetime.datetime) -> Health:
    organization_id = members_service.organization_of_manager(principal)
    organization = session.get(Organization, organization_id)
    storage_used = organization.storage_used_bytes if organization is not None else 0
    plan = organization_repository.plan_of(session, organization_id)
    subscription = session.scalar(
        select(Subscription).where(Subscription.organization_id == organization_id)
    )
    seats = members_service.seats(session, organization_id, now, actor_id=principal.user_id)
    members = organization_repository.member_count(session, organization_id)

    since = now - datetime.timedelta(days=WINDOW_DAYS)
    counts = dict(
        session.execute(
            select(AuditLog.action, func.count())
            .where(
                AuditLog.organization_id == organization_id,
                AuditLog.created_at >= since,
                AuditLog.action.in_([a for group in _INDICATORS.values() for a in group]),
            )
            .group_by(AuditLog.action)
        ).tuples()
    )
    indicators = {
        name: sum(counts.get(action, 0) for action in actions)
        for name, actions in _INDICATORS.items()
    }
    return Health(
        storage_used_bytes=storage_used,
        storage_limit_bytes=plan.storage_limit_bytes if plan is not None else None,
        plan_name=plan.name if plan is not None else None,
        subscription_status=subscription.status if subscription is not None else None,
        subscription_ends_at=_ends_at(subscription),
        members=members,
        seats_included=seats.included,
        seats_used=seats.used,
        window_days=WINDOW_DAYS,
        indicators=indicators,
    )


def _ends_at(subscription: Subscription | None) -> datetime.datetime | None:
    """La fecha que le importa a quien gestiona: fin de la prueba, del periodo o de la lectura."""
    if subscription is None:
        return None
    if subscription.status == "trial":
        return subscription.trial_ends_at
    if subscription.status in ("canceled", "expired"):
        return subscription.read_only_until
    return subscription.current_period_end or subscription.courtesy_ends_at
