"""Acciones de auditoría para el primer cobro de una suscripción con Wompi.

Revisión: 0021
Anterior: 0020
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0021"
down_revision: str | Sequence[str] | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ACTIONS_BEFORE = (
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
)
_PAYMENT_ACTIONS = ("payment_approved", "payment_declined")


def _check(actions: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{action}'" for action in actions) + ")"


def upgrade() -> None:
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _check((*_ACTIONS_BEFORE, *_PAYMENT_ACTIONS))
    )


def downgrade() -> None:
    op.execute("DELETE FROM audit_log WHERE action IN ('payment_approved', 'payment_declined')")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(op.f("ck_audit_log_action"), "audit_log", _check(_ACTIONS_BEFORE))
