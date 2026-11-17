"""Concesiones de cortesía trazables y búsqueda del titular por plataforma.

Revisión: 0019
Anterior: 0018
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0019"
down_revision: str | Sequence[str] | None = "0018"
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
    "account_blocked",
    "account_unblocked",
    "legal_accepted",
    "logout",
    "case_created",
    "platform_admin_granted",
    "support_ticket_opened",
    "support_ticket_closed",
    "support_ticket_reopened",
    "subscription_expired",
)
_COURTESY_ACTIONS = ("courtesy_granted", "courtesy_renewed", "courtesy_revoked")


def _check(actions: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{action}'" for action in actions) + ")"


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("access_source", sa.Text(), server_default="legacy", nullable=False),
    )
    op.add_column("subscriptions", sa.Column("courtesy_reason", sa.Text()))
    op.add_column("subscriptions", sa.Column("courtesy_granted_by", sa.Uuid()))
    op.add_column("subscriptions", sa.Column("courtesy_granted_at", sa.DateTime(timezone=True)))
    op.add_column("subscriptions", sa.Column("courtesy_revoked_at", sa.DateTime(timezone=True)))
    op.add_column("audit_log", sa.Column("details", JSONB()))
    op.create_foreign_key(
        op.f("fk_subscriptions_courtesy_granted_by_users"),
        "subscriptions",
        "users",
        ["courtesy_granted_by"],
        ["id"],
    )
    op.create_check_constraint(
        op.f("ck_subscriptions_access_source"),
        "subscriptions",
        "access_source IN ('trial', 'courtesy', 'payment', 'legacy')",
    )
    op.create_check_constraint(
        op.f("ck_subscriptions_courtesy_reason_length"),
        "subscriptions",
        "courtesy_reason IS NULL OR char_length(courtesy_reason) BETWEEN 10 AND 500",
    )
    op.execute(
        "UPDATE subscriptions SET access_source = 'trial' "
        "WHERE status IN ('trial', 'expired') "
        "AND plan_id IN (SELECT id FROM plans WHERE code = 'trial')"
    )
    op.execute(
        "UPDATE subscriptions SET access_source = 'payment' "
        "WHERE gateway_subscription_id IS NOT NULL"
    )
    owner = "EXISTS (SELECT 1 FROM users WHERE id = app_user_id() AND is_platform_admin)"
    op.execute(
        f"CREATE POLICY platform_read ON memberships FOR SELECT TO aletheia_app USING ({owner})"
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _check((*_ACTIONS_BEFORE, *_COURTESY_ACTIONS))
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM audit_log WHERE action IN "
        "('courtesy_granted', 'courtesy_renewed', 'courtesy_revoked')"
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(op.f("ck_audit_log_action"), "audit_log", _check(_ACTIONS_BEFORE))
    op.execute("DROP POLICY platform_read ON memberships")
    op.drop_column("audit_log", "details")
    op.drop_constraint(
        op.f("ck_subscriptions_courtesy_reason_length"), "subscriptions", type_="check"
    )
    op.drop_constraint(op.f("ck_subscriptions_access_source"), "subscriptions", type_="check")
    op.drop_constraint(
        op.f("fk_subscriptions_courtesy_granted_by_users"), "subscriptions", type_="foreignkey"
    )
    for column in (
        "courtesy_revoked_at",
        "courtesy_granted_at",
        "courtesy_granted_by",
        "courtesy_reason",
        "access_source",
    ):
        op.drop_column("subscriptions", column)
