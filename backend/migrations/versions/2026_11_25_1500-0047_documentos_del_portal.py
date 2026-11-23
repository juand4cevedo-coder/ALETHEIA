"""documentos del portal: copias que el despacho sube para el cliente

Son copias aparte, cifradas con la llave del caso y fuera de la cadena de custodia (ADR-054).
Viven en la organización, bajo Row-Level Security.

Revision ID: 0047
Revises: 0046
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0047"
down_revision: str | Sequence[str] | None = "0046"
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
    "client_portal_message_sent",
)

_NEW_ACTIONS = (
    "client_portal_document_added",
    "client_portal_document_removed",
    "client_portal_document_downloaded",
)


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.create_table(
        "client_portal_documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("uploaded_by", sa.Uuid(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("content_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.LargeBinary(), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("removed_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_client_portal_documents")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_client_portal_documents_storage_key")),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
            name=op.f("fk_client_portal_documents_organization_id_case_id_cases"),
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_client_portal_documents_uploaded_by_users"),
        ),
        sa.ForeignKeyConstraint(
            ["removed_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_client_portal_documents_removed_by_users"),
        ),
        sa.CheckConstraint(
            "char_length(filename) BETWEEN 1 AND 255",
            name=op.f("ck_client_portal_documents_filename_length"),
        ),
        sa.CheckConstraint(
            "octet_length(sha256) = 32", name=op.f("ck_client_portal_documents_sha256_length")
        ),
        sa.CheckConstraint("size_bytes > 0", name=op.f("ck_client_portal_documents_size_bytes")),
        sa.CheckConstraint(
            "char_length(storage_key) BETWEEN 1 AND 200",
            name=op.f("ck_client_portal_documents_storage_key_length"),
        ),
    )
    op.create_index(
        "ix_client_portal_documents_case_id_id", "client_portal_documents", ["case_id", "id"]
    )
    op.execute("ALTER TABLE client_portal_documents ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY client_portal_documents_isolation ON client_portal_documents "
        "TO aletheia_app USING (organization_id = app_organization_id()) "
        "WITH CHECK (organization_id = app_organization_id())"
    )
    op.execute("REVOKE ALL ON client_portal_documents FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT, UPDATE ON client_portal_documents TO aletheia_app")

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
    op.drop_table("client_portal_documents")
