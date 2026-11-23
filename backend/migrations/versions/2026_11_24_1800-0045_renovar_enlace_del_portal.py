"""el cliente pide un enlace nuevo del portal con el enlace vencido

Solo agrega una acción de auditoría (ADR-054): el enlace nuevo va siempre al correo con que se
invitó al cliente, y cada renovación queda en la auditoría del despacho.

Revision ID: 0045
Revises: 0044
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0045"
down_revision: str | Sequence[str] | None = "0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_AUDIT_BEFORE = (
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
    "legal_accepted",
    "logout",
    "case_created",
    "platform_admin_granted",
    "support_ticket_opened",
    "support_ticket_closed",
    "support_ticket_reopened",
    "payment_approved",
    "payment_declined",
    "organization_renamed",
    "case_closed",
    "case_reopened",
    "case_retention_updated",
    "case_task_created",
    "case_task_status_changed",
    "case_note_created",
    "organization_policy_changed",
    "two_factor_enabled",
    "two_factor_disabled",
    "two_factor_failed",
    "two_factor_recovery_used",
    "two_factor_codes_regenerated",
    "evidence_link_downloaded",
    "task_template_created",
    "task_template_updated",
    "task_template_deleted",
    "account_closed",
    "two_factor_recovery_requested",
    "two_factor_recovery_canceled",
    "two_factor_recovery_completed",
    "client_portal_invited",
    "client_portal_revoked",
    "client_portal_notice_accepted",
    "client_portal_update_published",
)

_NEW_ACTIONS = ("client_portal_renewed",)


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _actions((*_AUDIT_BEFORE, *_NEW_ACTIONS))
    )


def downgrade() -> None:
    for action in _NEW_ACTIONS:
        op.execute(
            sa.text("DELETE FROM audit_log WHERE action = :action").bindparams(action=action)
        )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(op.f("ck_audit_log_action"), "audit_log", _actions(_AUDIT_BEFORE))
