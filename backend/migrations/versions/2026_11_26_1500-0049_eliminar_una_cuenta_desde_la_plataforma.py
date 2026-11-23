"""eliminar una cuenta desde la plataforma

La cuenta propietaria de la plataforma puede eliminar definitivamente a una persona, por ejemplo
una cuenta de prueba. Es la misma anonimización del cierre de cuenta (el correo queda libre y la
fila sobrevive como seudónimo para no reescribir autorías ni custodia), pero pedida por la
plataforma y no por la persona. La función corre como dueño del esquema y se autoriza sola: solo
la acepta quien tiene la sesión de plataforma y nunca contra otra cuenta de plataforma.

Revision ID: 0049
Revises: 0048
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0049"
down_revision: str | Sequence[str] | None = "0048"
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
)

_NEW_ACTIONS = ("account_deleted_by_platform",)


def _actions(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION delete_user_as_platform(
            target_user_id uuid,
            actor_user_id uuid
        ) RETURNS uuid
        LANGUAGE plpgsql SECURITY DEFINER
        SET search_path = public, pg_temp
        AS $$
        DECLARE
          v_organization uuid;
          v_role text;
        BEGIN
          IF actor_user_id IS DISTINCT FROM app_user_id() THEN
            RAISE insufficient_privilege USING MESSAGE = 'la sesión no es de quien lo pide';
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM users
            WHERE id = actor_user_id AND is_platform_admin AND status = 'active'
          ) THEN
            RAISE insufficient_privilege USING MESSAGE = 'solo la plataforma elimina cuentas';
          END IF;
          IF target_user_id = actor_user_id THEN
            RAISE insufficient_privilege USING MESSAGE = 'no puede eliminar su propia cuenta';
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM users
            WHERE id = target_user_id AND status <> 'closed' AND NOT is_platform_admin
          ) THEN
            RAISE insufficient_privilege USING MESSAGE = 'la cuenta no se puede eliminar';
          END IF;

          SELECT organization_id, role INTO v_organization, v_role
          FROM memberships WHERE user_id = target_user_id;
          IF v_role = 'owner' THEN
            IF (SELECT count(*) FROM memberships WHERE organization_id = v_organization) > 1 THEN
              RAISE EXCEPTION 'el responsable del despacho tiene equipo'
                USING ERRCODE = 'object_not_in_prerequisite_state';
            END IF;
            UPDATE organizations SET status = 'closed' WHERE id = v_organization;
            UPDATE subscriptions
            SET status = 'canceled', pending_checkout_reference = NULL
            WHERE organization_id = v_organization;
            UPDATE invitations SET revoked_at = now()
            WHERE organization_id = v_organization
              AND accepted_at IS NULL AND revoked_at IS NULL;
          END IF;

          DELETE FROM memberships WHERE user_id = target_user_id;
          DELETE FROM oauth_identities WHERE user_id = target_user_id;
          UPDATE refresh_tokens SET revoked_at = now()
          WHERE user_id = target_user_id AND revoked_at IS NULL;
          UPDATE users
          SET email = 'closed-' || id::text || '@deleted.invalid',
              full_name = 'Cuenta eliminada',
              password_hash = NULL,
              email_verified_at = NULL,
              security_stamp = gen_random_uuid(),
              status = 'closed',
              updated_at = now()
          WHERE id = target_user_id;
          RETURN v_organization;
        END
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION delete_user_as_platform(uuid, uuid) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION delete_user_as_platform(uuid, uuid) TO aletheia_app")
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
    op.execute("DROP FUNCTION IF EXISTS delete_user_as_platform(uuid, uuid)")
