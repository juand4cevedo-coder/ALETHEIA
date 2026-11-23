"""segundo factor de autenticación

Cada persona puede activar un segundo factor con una aplicación de autenticación (TOTP). El
secreto se guarda cifrado y los códigos de respaldo solo como HMAC. Son datos de la persona, no
de una organización: no llevan organization_id, la API los toca únicamente con el identificador
de la sesión y ningún rol de soporte los lee.

Revision ID: 0038
Revises: 0037
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0038"
down_revision: str | Sequence[str] | None = "0037"
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
    "account_closed",
    "case_note_created",
    "organization_policy_changed",
)

_NEW_ACTIONS = (
    "two_factor_enabled",
    "two_factor_disabled",
    "two_factor_failed",
    "two_factor_recovery_used",
    "two_factor_codes_regenerated",
)


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.create_table(
        "user_two_factor",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("secret_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("enabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_step", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_user_two_factor")),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_user_two_factor_user_id_users"),
        ),
    )
    op.create_table(
        "two_factor_recovery_codes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("code_hash", sa.LargeBinary(), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_two_factor_recovery_codes")),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_two_factor_recovery_codes_user_id_users"),
        ),
        sa.UniqueConstraint(
            "user_id", "code_hash", name=op.f("uq_two_factor_recovery_codes_user_id_code_hash")
        ),
        sa.CheckConstraint(
            "octet_length(code_hash) = 32", name=op.f("ck_two_factor_recovery_codes_code_hash")
        ),
    )
    op.create_index(
        "ix_two_factor_recovery_codes_user_id", "two_factor_recovery_codes", ["user_id"]
    )
    for table in ("user_two_factor", "two_factor_recovery_codes"):
        op.execute(f"REVOKE ALL ON {table} FROM PUBLIC")
        op.execute(f"REVOKE ALL ON {table} FROM aletheia_app")
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO aletheia_app")
        # El soporte de plataforma no ve secretos ni códigos de nadie.
        op.execute(f"REVOKE ALL ON {table} FROM aletheia_support")

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
    op.drop_table("two_factor_recovery_codes")
    op.drop_table("user_two_factor")
