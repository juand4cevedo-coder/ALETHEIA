"""fuente de pago vinculada para renovar el plan sin intervención

Una organización puede vincular una fuente de pago (Nequi) para que su plan se renueve solo.
La fila guarda el consentimiento exacto que dio la persona (versión del texto, fecha, quién y
desde qué IP) y el identificador de la fuente en Wompi, nunca datos de pago. Vincular y
cancelar quedan en la auditoría del despacho.

Revision ID: 0055
Revises: 0054
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0055"
down_revision: str | Sequence[str] | None = "0054"
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
    "client_portal_document_added",
    "client_portal_document_removed",
    "client_portal_document_downloaded",
    "case_deletion_requested",
    "case_deleted",
    "account_deleted_by_platform",
    "evidence_stamp_retried",
    "ownership_transferred",
    "plan_updated",
    "archive_exported",
)

_NEW_ACTIONS = ("payment_source_linked", "payment_source_canceled")


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.create_table(
        "payment_sources",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("gateway_token", sa.Text(), nullable=True),
        sa.Column("gateway_source_id", sa.BigInteger(), nullable=True),
        sa.Column("phone_last4", sa.Text(), nullable=False),
        sa.Column("consent_version", sa.Text(), nullable=False),
        sa.Column("consent_accepted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consent_ip", sa.Text(), nullable=True),
        sa.Column("linked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment_sources")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="RESTRICT",
            name=op.f("fk_payment_sources_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_payment_sources_created_by_users"),
        ),
        sa.ForeignKeyConstraint(
            ["canceled_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_payment_sources_canceled_by_users"),
        ),
        sa.CheckConstraint("kind IN ('nequi')", name=op.f("ck_payment_sources_kind")),
        sa.CheckConstraint(
            "status IN ('pending', 'active', 'declined', 'canceled')",
            name=op.f("ck_payment_sources_status"),
        ),
        sa.CheckConstraint(
            "char_length(phone_last4) = 4", name=op.f("ck_payment_sources_phone_last4")
        ),
        sa.CheckConstraint(
            "status <> 'active' OR gateway_source_id IS NOT NULL",
            name=op.f("ck_payment_sources_active_has_source"),
        ),
    )
    # Una fuente viva (en trámite o activa) por organización.
    op.create_index(
        "uq_payment_sources_one_live_per_organization",
        "payment_sources",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('pending', 'active')"),
    )
    op.execute("ALTER TABLE payment_sources ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY payment_sources_isolation ON payment_sources TO aletheia_app "
        "USING (organization_id = app_organization_id()) "
        "WITH CHECK (organization_id = app_organization_id())"
    )
    # El consentimiento que dio la persona no se borra: la fuente solo cambia de estado.
    op.execute("REVOKE ALL ON payment_sources FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT, UPDATE ON payment_sources TO aletheia_app")
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
    op.drop_table("payment_sources")
