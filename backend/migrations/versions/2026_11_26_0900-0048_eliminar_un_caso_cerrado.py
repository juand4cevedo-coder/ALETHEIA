"""eliminar un caso cerrado: solicitud con llave destruida y constancia

Pedir la eliminación pasa un caso cerrado, sin bloqueo jurídico y con la conservación vencida, a
«deleting» y destruye su llave envuelta en el mismo instante: desde ahí su contenido cifrado es
irrecuperable. La tarea `case_purge` borra después los objetos y llama a `purge_case`, que deja
la constancia y elimina el expediente (SEQ-004, RN-006). Solo dueños y administradores.

Revision ID: 0048
Revises: 0047
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0048"
down_revision: str | Sequence[str] | None = "0047"
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
)

_NEW_ACTIONS = ("case_deletion_requested", "case_deleted")


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION request_case_deletion(
            p_case_id uuid,
            p_organization_id uuid,
            p_actor_user_id uuid
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
                  AND m.role IN ('owner', 'admin')
                  AND u.status = 'active'
                  AND o.status = 'active'
            ) THEN
                RAISE EXCEPTION 'eliminación no autorizada' USING ERRCODE = '42501';
            END IF;

            UPDATE cases
            SET status = 'deleting',
                wrapped_key = NULL
            WHERE id = p_case_id
              AND organization_id = p_organization_id
              AND status = 'closed'
              AND legal_hold = false
              AND retention_until IS NOT NULL
              AND retention_until <= now();

            GET DIAGNOSTICS changed = ROW_COUNT;
            IF changed <> 1 THEN
                RAISE EXCEPTION 'el caso no admite la eliminación' USING ERRCODE = '55000';
            END IF;
        END;
        $$
        """
    )
    op.execute(
        "REVOKE ALL ON FUNCTION request_case_deletion(uuid, uuid, uuid) "
        "FROM PUBLIC, aletheia_support"
    )
    op.execute("GRANT EXECUTE ON FUNCTION request_case_deletion(uuid, uuid, uuid) TO aletheia_app")
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
    op.execute("DROP FUNCTION IF EXISTS request_case_deletion(uuid, uuid, uuid)")
