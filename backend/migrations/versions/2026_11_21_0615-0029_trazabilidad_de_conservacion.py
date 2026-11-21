"""trazabilidad de conservación

Revisión: 0029
Anterior: 0028

Permite registrar en la cadena de custodia y en la auditoría cada cambio del fundamento de
conservación o de su bloqueo jurídico.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0029"
down_revision: str | Sequence[str] | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CUSTODY_BEFORE = (
    "case_created",
    "member_added",
    "member_removed",
    "evidence_uploaded",
    "evidence_stamped",
    "evidence_stamp_failed",
    "evidence_downloaded",
    "export_requested",
    "export_ready",
    "export_downloaded",
    "chain_verified",
    "case_closed",
    "case_reopened",
    "deletion_requested",
)
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
)
_ACTION = "case_retention_updated"


def _allowed(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def _replace(table: str, values: tuple[str, ...]) -> None:
    name = op.f(f"ck_{table}_action")
    op.drop_constraint(name, table, type_="check")
    op.create_check_constraint(name, table, _allowed(values))


def upgrade() -> None:
    _replace("custody_events", (*_CUSTODY_BEFORE, _ACTION))
    _replace("audit_log", (*_AUDIT_BEFORE, _ACTION))
    op.execute(
        """
        CREATE FUNCTION transition_case_retention(
            p_case_id uuid,
            p_organization_id uuid,
            p_actor_user_id uuid,
            p_legal_hold boolean,
            p_retention_basis text
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
            IF p_legal_hold IS DISTINCT FROM (p_retention_basis = 'litigation_hold')
               OR p_retention_basis NOT IN (
                   'organization_policy', 'legal_or_contractual_duty', 'litigation_hold'
               ) THEN
                RAISE EXCEPTION 'conservación incoherente' USING ERRCODE = '23514';
            END IF;
            IF NOT EXISTS (
                SELECT 1
                FROM memberships m
                JOIN users u ON u.id = m.user_id
                JOIN organizations o ON o.id = m.organization_id
                JOIN case_members cm
                  ON cm.organization_id = m.organization_id
                 AND cm.user_id = m.user_id
                 AND cm.case_id = p_case_id
                WHERE m.organization_id = p_organization_id
                  AND m.user_id = p_actor_user_id
                  AND m.role IN ('owner', 'admin')
                  AND u.status = 'active'
                  AND o.status = 'active'
            ) THEN
                RAISE EXCEPTION 'gestión de conservación no autorizada' USING ERRCODE = '42501';
            END IF;

            UPDATE cases
            SET legal_hold = p_legal_hold,
                retention_basis = p_retention_basis
            WHERE id = p_case_id
              AND organization_id = p_organization_id
              AND status = 'closed';
            GET DIAGNOSTICS changed = ROW_COUNT;
            IF changed <> 1 THEN
                RAISE EXCEPTION 'el caso no está archivado' USING ERRCODE = '23514';
            END IF;
        END;
        $$
        """
    )
    op.execute(
        "REVOKE ALL ON FUNCTION transition_case_retention(uuid, uuid, uuid, boolean, text) "
        "FROM PUBLIC"
    )
    op.execute(
        "GRANT EXECUTE ON FUNCTION "
        "transition_case_retention(uuid, uuid, uuid, boolean, text) TO aletheia_app"
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS transition_case_retention(uuid, uuid, uuid, boolean, text)")
    op.execute("DELETE FROM custody_events WHERE action = 'case_retention_updated'")
    op.execute("DELETE FROM audit_log WHERE action = 'case_retention_updated'")
    _replace("audit_log", _AUDIT_BEFORE)
    _replace("custody_events", _CUSTODY_BEFORE)
