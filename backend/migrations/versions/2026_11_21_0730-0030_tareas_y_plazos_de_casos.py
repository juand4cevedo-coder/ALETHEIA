"""tareas y plazos de casos

Revisión: 0030
Anterior: 0029

Agrega trabajo asignable por caso con plazos, prioridad, estados, aislamiento por despacho y
trazabilidad de creación y cambios de estado.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0030"
down_revision: str | Sequence[str] | None = "0029"
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
    "account_closed",
    "case_retention_updated",
)
_TASK_ACTIONS = ("case_task_created", "case_task_status_changed")


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.create_table(
        "case_tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("priority", sa.Text(), server_default="normal", nullable=False),
        sa.Column("status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("assigned_to", sa.Uuid(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_case_tasks")),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            name=op.f("fk_case_tasks_organization_id_case_id_cases"),
        ),
        sa.ForeignKeyConstraint(
            ["case_id", "assigned_to"],
            ["case_members.case_id", "case_members.user_id"],
            ondelete="RESTRICT",
            name=op.f("fk_case_tasks_case_id_assigned_to_case_members"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_case_tasks_created_by_users"),
        ),
        sa.CheckConstraint(
            "char_length(title) BETWEEN 1 AND 160", name=op.f("ck_case_tasks_title_length")
        ),
        sa.CheckConstraint(
            "description IS NULL OR char_length(description) BETWEEN 1 AND 1000",
            name=op.f("ck_case_tasks_description_length"),
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name=op.f("ck_case_tasks_priority"),
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'in_progress', 'completed', 'canceled')",
            name=op.f("ck_case_tasks_status"),
        ),
        sa.CheckConstraint(
            "(status = 'completed') = (completed_at IS NOT NULL)",
            name=op.f("ck_case_tasks_completed_at"),
        ),
    )
    op.create_index("ix_case_tasks_case_id_id", "case_tasks", ["case_id", "id"])
    op.create_index(
        "ix_case_tasks_assigned_to_status_due_at",
        "case_tasks",
        ["assigned_to", "status", "due_at"],
    )
    op.execute("ALTER TABLE case_tasks ENABLE ROW LEVEL SECURITY")
    member = (
        "organization_id = app_organization_id() AND EXISTS ("
        "SELECT 1 FROM case_members cm WHERE cm.case_id = case_tasks.case_id "
        "AND cm.user_id = app_user_id())"
    )
    manager = (
        "EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id = case_tasks.organization_id "
        "AND m.user_id = app_user_id() AND m.role IN ('owner', 'admin', 'lawyer'))"
    )
    op.execute(
        f"CREATE POLICY case_task_read ON case_tasks FOR SELECT TO aletheia_app USING ({member})"
    )
    op.execute(
        "CREATE POLICY case_task_insert ON case_tasks FOR INSERT TO aletheia_app "
        f"WITH CHECK ({member} AND {manager} AND created_by = app_user_id())"
    )
    op.execute(
        "CREATE POLICY case_task_update ON case_tasks FOR UPDATE TO aletheia_app "
        f"USING ({member} AND ({manager} OR assigned_to = app_user_id())) "
        f"WITH CHECK ({member} AND ({manager} OR assigned_to = app_user_id()))"
    )
    op.execute("REVOKE ALL ON case_tasks FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT ON case_tasks TO aletheia_app")
    op.execute("GRANT UPDATE (status, updated_at, completed_at) ON case_tasks TO aletheia_app")

    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"),
        "audit_log",
        _actions((*_AUDIT_BEFORE, *_TASK_ACTIONS)),
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM audit_log WHERE action IN ('case_task_created', 'case_task_status_changed')"
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(op.f("ck_audit_log_action"), "audit_log", _actions(_AUDIT_BEFORE))
    op.drop_table("case_tasks")
