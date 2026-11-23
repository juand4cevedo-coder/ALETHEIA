"""portal del cliente: accesos por correo y avisos que el despacho comparte

Cada acceso liga a un cliente con un caso; el enlace va firmado y la fila decide si sigue
vigente. Los avisos son lo único que el cliente ve del expediente (ADR-054). Las dos tablas
viven en la organización, bajo Row-Level Security.

Revision ID: 0044
Revises: 0043
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0044"
down_revision: str | Sequence[str] | None = "0043"
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
)

_NEW_ACTIONS = (
    "client_portal_invited",
    "client_portal_revoked",
    "client_portal_notice_accepted",
    "client_portal_update_published",
)


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def _tenant_table(table: str, grants: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {table}_isolation ON {table} TO aletheia_app "
        "USING (organization_id = app_organization_id()) "
        "WITH CHECK (organization_id = app_organization_id())"
    )
    op.execute(f"REVOKE ALL ON {table} FROM aletheia_app")
    op.execute(f"GRANT {grants} ON {table} TO aletheia_app")


def upgrade() -> None:
    op.create_table(
        "client_portal_accesses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("client_name", sa.Text(), nullable=False),
        sa.Column("client_email", sa.Text(), nullable=False),
        sa.Column("link_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by", sa.Uuid(), nullable=True),
        sa.Column("notice_accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_visit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_client_portal_accesses")),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
            name=op.f("fk_client_portal_accesses_organization_id_case_id_cases"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_client_portal_accesses_created_by_users"),
        ),
        sa.ForeignKeyConstraint(
            ["revoked_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_client_portal_accesses_revoked_by_users"),
        ),
        sa.CheckConstraint(
            "char_length(client_name) BETWEEN 1 AND 120",
            name=op.f("ck_client_portal_accesses_client_name"),
        ),
        sa.CheckConstraint(
            "char_length(client_email) BETWEEN 3 AND 254",
            name=op.f("ck_client_portal_accesses_client_email"),
        ),
        sa.CheckConstraint(
            "link_version >= 1", name=op.f("ck_client_portal_accesses_link_version")
        ),
    )
    op.create_index(
        "uq_client_portal_accesses_open",
        "client_portal_accesses",
        ["case_id", "client_email"],
        unique=True,
        postgresql_where=sa.text("revoked_at IS NULL"),
    )
    _tenant_table("client_portal_accesses", "SELECT, INSERT, UPDATE")

    op.create_table(
        "client_portal_updates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_client_portal_updates")),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
            name=op.f("fk_client_portal_updates_organization_id_case_id_cases"),
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_client_portal_updates_author_id_users"),
        ),
        sa.CheckConstraint(
            "char_length(body) BETWEEN 1 AND 2000",
            name=op.f("ck_client_portal_updates_body_length"),
        ),
    )
    op.create_index(
        "ix_client_portal_updates_case_id_id", "client_portal_updates", ["case_id", "id"]
    )
    _tenant_table("client_portal_updates", "SELECT, INSERT")

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
    op.drop_table("client_portal_updates")
    op.drop_index("uq_client_portal_accesses_open", table_name="client_portal_accesses")
    op.drop_table("client_portal_accesses")
