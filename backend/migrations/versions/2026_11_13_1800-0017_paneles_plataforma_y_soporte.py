"""Solicitudes de soporte y lectura acotada de facturación y auditoría de plataforma.

Revisión: 0017
Anterior: 0016
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | Sequence[str] | None = "0016"
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
)
_ACTIONS_SUPPORT = ("support_ticket_opened", "support_ticket_closed", "support_ticket_reopened")


def _actions_check(actions: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{action}'" for action in actions) + ")"


def upgrade() -> None:
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="open", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_support_tickets")),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_support_tickets_user_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="SET NULL",
            name=op.f("fk_support_tickets_organization_id_organizations"),
        ),
        sa.CheckConstraint(
            "char_length(subject) BETWEEN 5 AND 120", name=op.f("ck_support_tickets_subject_length")
        ),
        sa.CheckConstraint(
            "char_length(message) BETWEEN 10 AND 3000",
            name=op.f("ck_support_tickets_message_length"),
        ),
        sa.CheckConstraint("status IN ('open', 'closed')", name=op.f("ck_support_tickets_status")),
    )
    op.create_index("ix_support_tickets_created_at", "support_tickets", ["created_at"])
    op.execute("ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY")
    owner = "EXISTS (SELECT 1 FROM users WHERE id = app_user_id() AND is_platform_admin)"
    op.execute(
        "CREATE POLICY ticket_owner_read ON support_tickets FOR SELECT TO aletheia_app "
        "USING (user_id = app_user_id())"
    )
    op.execute(
        "CREATE POLICY ticket_platform_read ON support_tickets FOR SELECT TO aletheia_app "
        f"USING ({owner})"
    )
    op.execute(
        "CREATE POLICY ticket_owner_insert ON support_tickets FOR INSERT TO aletheia_app "
        "WITH CHECK (user_id = app_user_id() AND status = 'open')"
    )
    op.execute(
        "CREATE POLICY ticket_platform_update ON support_tickets FOR UPDATE TO aletheia_app "
        f"USING ({owner}) WITH CHECK ({owner})"
    )
    op.execute("REVOKE UPDATE, DELETE ON support_tickets FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT ON support_tickets TO aletheia_app")
    op.execute("GRANT UPDATE (status, updated_at, closed_at) ON support_tickets TO aletheia_app")
    op.execute(
        f"CREATE POLICY platform_read ON subscriptions FOR SELECT TO aletheia_app USING ({owner})"
    )
    op.execute(
        f"CREATE POLICY platform_read ON audit_log FOR SELECT TO aletheia_app USING ({owner})"
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _actions_check(_ACTIONS_BEFORE + _ACTIONS_SUPPORT)
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM audit_log WHERE action IN "
        "('support_ticket_opened', 'support_ticket_closed', 'support_ticket_reopened')"
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _actions_check(_ACTIONS_BEFORE)
    )
    op.execute("DROP POLICY platform_read ON audit_log")
    op.execute("DROP POLICY platform_read ON subscriptions")
    op.drop_index("ix_support_tickets_created_at", table_name="support_tickets")
    op.drop_table("support_tickets")
