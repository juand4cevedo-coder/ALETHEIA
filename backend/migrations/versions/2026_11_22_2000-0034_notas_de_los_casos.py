"""notas de los casos

Revisión: 0034
Anterior: 0033

Agrega notas internas por caso: texto libre de quien trabaja el expediente, fuera de la cadena
de custodia. Solo se agregan: no hay UPDATE ni DELETE, así que una corrección es una nota nueva y
nada de lo escrito se pierde. Cada nota deja constancia en la auditoría.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0034"
down_revision: str | Sequence[str] | None = "0033"
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
)


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.create_table(
        "case_notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_case_notes")),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
            name=op.f("fk_case_notes_organization_id_case_id_cases"),
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_case_notes_author_id_users"),
        ),
        sa.CheckConstraint(
            "char_length(body) BETWEEN 1 AND 4000", name=op.f("ck_case_notes_body_length")
        ),
    )
    op.create_index("ix_case_notes_case_id_id", "case_notes", ["case_id", "id"])
    op.execute("ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY")
    member = (
        "organization_id = app_organization_id() AND EXISTS ("
        "SELECT 1 FROM case_members cm WHERE cm.case_id = case_notes.case_id "
        "AND cm.user_id = app_user_id())"
    )
    op.execute(
        f"CREATE POLICY case_note_read ON case_notes FOR SELECT TO aletheia_app USING ({member})"
    )
    op.execute(
        "CREATE POLICY case_note_insert ON case_notes FOR INSERT TO aletheia_app "
        f"WITH CHECK ({member} AND author_id = app_user_id())"
    )
    op.execute("REVOKE ALL ON case_notes FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT ON case_notes TO aletheia_app")

    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"),
        "audit_log",
        _actions((*_AUDIT_BEFORE, "case_note_created")),
    )


def downgrade() -> None:
    op.execute("DELETE FROM audit_log WHERE action = 'case_note_created'")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(op.f("ck_audit_log_action"), "audit_log", _actions(_AUDIT_BEFORE))
    op.drop_table("case_notes")
