"""recuperación del segundo factor con espera de seguridad

Quien pierde el teléfono y los códigos de respaldo ya no depende de soporte: confirma el pedido
con el enlace de su correo y su contraseña, y espera 24 horas, durante las cuales ella y los
dueños de su despacho pueden cancelarlo. Pasada la espera, termina la recuperación y el segundo
factor queda desactivado (ADR-053). Es de la persona, no de una organización: sin
organization_id y sin acceso para el soporte de plataforma.

Revision ID: 0043
Revises: 0042
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0043"
down_revision: str | Sequence[str] | None = "0042"
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
)

_NEW_ACTIONS = (
    "two_factor_recovery_requested",
    "two_factor_recovery_canceled",
    "two_factor_recovery_completed",
)


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.create_table(
        "two_factor_recoveries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_two_factor_recoveries")),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_two_factor_recoveries_user_id_users"),
        ),
        sa.CheckConstraint(
            "available_at > created_at",
            name=op.f("ck_two_factor_recoveries_available_after_created"),
        ),
        sa.CheckConstraint(
            "expires_at > available_at",
            name=op.f("ck_two_factor_recoveries_expires_after_available"),
        ),
    )
    op.create_index(
        "uq_two_factor_recoveries_open_user",
        "two_factor_recoveries",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("canceled_at IS NULL AND completed_at IS NULL"),
    )
    op.execute("REVOKE ALL ON two_factor_recoveries FROM PUBLIC")
    op.execute("REVOKE ALL ON two_factor_recoveries FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON two_factor_recoveries TO aletheia_app")
    op.execute("REVOKE ALL ON two_factor_recoveries FROM aletheia_support")

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
    op.drop_index("uq_two_factor_recoveries_open_user", table_name="two_factor_recoveries")
    op.drop_table("two_factor_recoveries")
