"""Consulta de eventos de seguridad del despacho (HU-014)."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog
from app.services.members import organization_of_manager
from app.services.sessions import Principal

# Los eventos operativos de casos y soporte no pertenecen a la auditoría de seguridad del
# despacho. La lista explícita impide que un tipo nuevo exponga datos por accidente.
SECURITY_ACTIONS = (
    "user_registered",
    "email_verified",
    "login",
    "login_failed",
    "google_linked",
    "session_reuse_detected",
    "sessions_revoked",
    "password_reset",
    "password_changed",
    "invitation_sent",
    "invitation_revoked",
    "invitation_accepted",
    "role_changed",
    "member_removed",
    "plan_changed",
    "subscription_canceled",
    "subscription_expired",
    "courtesy_granted",
    "courtesy_renewed",
    "courtesy_revoked",
    "account_blocked",
    "account_unblocked",
    "account_closed",
    "legal_accepted",
    "logout",
)


def events(
    session: Session, principal: Principal, *, after: uuid.UUID | None, limit: int
) -> list[AuditLog]:
    """Pagina eventos de la organización del gestor; RLS refuerza el mismo límite."""
    organization_id = organization_of_manager(principal)
    query = (
        select(AuditLog)
        .where(
            AuditLog.organization_id == organization_id,
            AuditLog.action.in_(SECURITY_ACTIONS),
        )
        .order_by(AuditLog.id.desc())
        .limit(limit)
    )
    if after is not None:
        query = query.where(AuditLog.id < after)
    return list(session.scalars(query))
