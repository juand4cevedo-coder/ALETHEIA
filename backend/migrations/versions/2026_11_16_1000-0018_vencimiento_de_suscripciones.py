"""Fecha opcional de cortesía y auditoría de vencimientos.

Revisión: 0018
Anterior: 0017
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: str | Sequence[str] | None = "0017"
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
)


def _check(actions: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{action}'" for action in actions) + ")"


def upgrade() -> None:
    op.add_column("subscriptions", sa.Column("courtesy_ends_at", sa.DateTime(timezone=True)))
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _check((*_ACTIONS_BEFORE, "subscription_expired"))
    )

    # Las pruebas anteriores a esta versión también necesitan una tarea. UUIDv7 conserva
    # el orden temporal que usa la limpieza de jobs.
    connection = op.get_bind()
    trials = list(
        connection.execute(
            sa.text(
                "SELECT organization_id, trial_ends_at FROM subscriptions "
                "WHERE status = 'trial' AND trial_ends_at IS NOT NULL"
            )
        ).mappings()
    )
    for trial in trials:
        organization_id = trial["organization_id"]
        deadline = trial["trial_ends_at"]
        stamp = int(deadline.timestamp() * 1_000_000)
        connection.execute(
            sa.text(
                "INSERT INTO jobs (id, kind, payload, idempotency_key, run_after) "
                "VALUES (:id, 'subscription_expire', "
                "jsonb_build_object('organization_id', CAST(:organization_id AS text)), "
                ":key, :deadline) "
                "ON CONFLICT (idempotency_key) DO NOTHING"
            ),
            {
                "id": uuid.uuid7(),
                "organization_id": str(organization_id),
                "key": f"subscription_expire:{organization_id}:{stamp}",
                "deadline": deadline,
            },
        )


def downgrade() -> None:
    op.execute("DELETE FROM jobs WHERE kind = 'subscription_expire'")
    op.execute("DELETE FROM audit_log WHERE action = 'subscription_expired'")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(op.f("ck_audit_log_action"), "audit_log", _check(_ACTIONS_BEFORE))
    op.drop_column("subscriptions", "courtesy_ends_at")
