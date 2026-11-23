"""políticas del despacho

Cada despacho decide cuántos años conserva un caso archivado y cuántos días dura una sesión.
Los valores por omisión son los de hasta ahora (10 años y 14 días), así que ningún despacho
existente cambia de comportamiento. La conservación se calcula en la base, dentro de
transition_case_lifecycle, que ahora lee el plazo de la organización: un caso ya archivado
conserva el plazo con el que se archivó.

Revision ID: 0036
Revises: 0035
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0036"
down_revision: str | Sequence[str] | None = "0035"
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
)


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


# transition_case_lifecycle de la migración 0024 con el plazo de conservación tomado de la
# organización. El resto de la función no cambia.
_LIFECYCLE = """
CREATE OR REPLACE FUNCTION transition_case_lifecycle(
    p_case_id uuid,
    p_organization_id uuid,
    p_actor_user_id uuid,
    p_target_status text,
    p_occurred_at timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    changed integer;
BEGIN
    IF p_organization_id IS DISTINCT FROM app_organization_id()
       OR p_actor_user_id IS DISTINCT FROM app_user_id() THEN
        RAISE EXCEPTION 'contexto de organización inválido' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM memberships m
        JOIN users u ON u.id = m.user_id
        JOIN organizations o ON o.id = m.organization_id
        WHERE m.organization_id = p_organization_id
          AND m.user_id = p_actor_user_id
          AND m.role IN ('owner', 'admin', 'lawyer')
          AND u.status = 'active'
          AND o.status = 'active'
    ) THEN
        RAISE EXCEPTION 'transición no autorizada' USING ERRCODE = '42501';
    END IF;

    IF p_target_status = 'closed' THEN
        UPDATE cases
        SET status = 'closed',
            closed_at = p_occurred_at,
            retention_until = p_occurred_at + make_interval(
                years => %(years)s
            ),
            retention_basis = 'organization_policy',
            legal_hold = false
        WHERE id = p_case_id
          AND organization_id = p_organization_id
          AND status = 'open';
    ELSIF p_target_status = 'open' THEN
        UPDATE cases
        SET status = 'open',
            closed_at = NULL,
            retention_until = NULL,
            retention_basis = NULL,
            legal_hold = false
        WHERE id = p_case_id
          AND organization_id = p_organization_id
          AND status = 'closed';
    ELSE
        RAISE EXCEPTION 'estado de destino inválido' USING ERRCODE = '22023';
    END IF;

    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN
        RAISE EXCEPTION 'el caso no admite esa transición' USING ERRCODE = '55000';
    END IF;
END;
$$
"""


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("default_retention_years", sa.SmallInteger(), server_default="10", nullable=False),
    )
    op.add_column(
        "organizations",
        sa.Column("session_days", sa.SmallInteger(), server_default="14", nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_organizations_default_retention_years"),
        "organizations",
        "default_retention_years BETWEEN 1 AND 30",
    )
    op.create_check_constraint(
        op.f("ck_organizations_session_days"),
        "organizations",
        "session_days BETWEEN 1 AND 14",
    )
    op.execute(
        _LIFECYCLE.replace(
            "%(years)s",
            "(SELECT default_retention_years FROM organizations WHERE id = p_organization_id)",
        )
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"),
        "audit_log",
        _actions((*_AUDIT_BEFORE, "organization_policy_changed")),
    )


def downgrade() -> None:
    op.execute("DELETE FROM audit_log WHERE action = 'organization_policy_changed'")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(op.f("ck_audit_log_action"), "audit_log", _actions(_AUDIT_BEFORE))
    op.execute(_LIFECYCLE.replace("%(years)s", "10"))
    op.drop_constraint(op.f("ck_organizations_session_days"), "organizations", type_="check")
    op.drop_constraint(
        op.f("ck_organizations_default_retention_years"), "organizations", type_="check"
    )
    op.drop_column("organizations", "session_days")
    op.drop_column("organizations", "default_retention_years")
