"""mensajes del cliente al despacho desde el portal

Los mensajes son solo texto y solo se agregan (ADR-054). Viven en la organización, bajo
Row-Level Security; el despacho los marca como leídos.

Revision ID: 0046
Revises: 0045
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0046"
down_revision: str | Sequence[str] | None = "0045"
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
    "client_portal_renewed",
)

_NEW_ACTIONS = ("client_portal_message_sent",)


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.create_table(
        "client_portal_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("access_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_client_portal_messages")),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
            name=op.f("fk_client_portal_messages_organization_id_case_id_cases"),
        ),
        sa.ForeignKeyConstraint(
            ["access_id"],
            ["client_portal_accesses.id"],
            ondelete="CASCADE",
            name=op.f("fk_client_portal_messages_access_id_client_portal_accesses"),
        ),
        sa.CheckConstraint(
            "char_length(body) BETWEEN 1 AND 2000",
            name=op.f("ck_client_portal_messages_body_length"),
        ),
    )
    op.create_index(
        "ix_client_portal_messages_case_id_id", "client_portal_messages", ["case_id", "id"]
    )
    op.create_index(
        "ix_client_portal_messages_access_id_id", "client_portal_messages", ["access_id", "id"]
    )
    op.execute("ALTER TABLE client_portal_messages ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY client_portal_messages_isolation ON client_portal_messages "
        "TO aletheia_app USING (organization_id = app_organization_id()) "
        "WITH CHECK (organization_id = app_organization_id())"
    )
    op.execute("REVOKE ALL ON client_portal_messages FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT, UPDATE ON client_portal_messages TO aletheia_app")

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
    op.drop_table("client_portal_messages")
