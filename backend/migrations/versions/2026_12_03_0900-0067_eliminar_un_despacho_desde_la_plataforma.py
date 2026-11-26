"""eliminar un despacho desde la plataforma y guardar si es independiente o firma

La cuenta propietaria de la plataforma puede cerrar un despacho completo, no solo una cuenta: se
cierran y anonimizan las cuentas de todas sus personas, se cancela la suscripción, se revocan las
invitaciones y los accesos del portal del cliente, y el despacho queda cerrado. Los casos y sus
pruebas no se tocan: se conservan en solo lectura hasta cumplir su plazo de conservación, que no
depende de quién pida el cierre (ADR-061).

Además, cada despacho guarda si es una cuenta independiente o una firma, lo que se elige al
registrarse. Los despachos existentes se clasifican como independientes si tienen una sola
persona y llevan su nombre; los demás, como firmas.

Revision ID: 0067
Revises: 0066
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0067"
down_revision: str | Sequence[str] | None = "0066"
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
    "payment_source_linked",
    "payment_source_canceled",
    "support_ticket_deleted",
    "platform_job_retried",
)
_AUDIT_NEW = ("organization_deleted_by_platform",)


def _values(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("kind", sa.Text(), server_default="firm", nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_organizations_kind"), "organizations", "kind IN ('individual', 'firm')"
    )
    op.execute(
        """
        UPDATE organizations o
        SET kind = 'individual'
        WHERE (SELECT count(*) FROM memberships m WHERE m.organization_id = o.id) = 1
          AND EXISTS (
            SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
            WHERE m.organization_id = o.id AND m.role = 'owner' AND u.full_name = o.name
          )
        """
    )
    op.execute(
        """
        CREATE FUNCTION delete_organization_as_platform(
            target_organization_id uuid,
            actor_user_id uuid
        ) RETURNS integer
        LANGUAGE plpgsql SECURITY DEFINER
        SET search_path = public, pg_temp
        AS $$
        DECLARE
          v_people uuid[];
        BEGIN
          IF actor_user_id IS DISTINCT FROM app_user_id() THEN
            RAISE insufficient_privilege USING MESSAGE = 'la sesión no es de quien lo pide';
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM users
            WHERE id = actor_user_id AND is_platform_admin AND status = 'active'
          ) THEN
            RAISE insufficient_privilege USING MESSAGE = 'solo la plataforma elimina despachos';
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM organizations
            WHERE id = target_organization_id AND status <> 'closed'
          ) THEN
            RAISE no_data_found USING MESSAGE = 'el despacho no existe o ya está cerrado';
          END IF;
          IF EXISTS (
            SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
            WHERE m.organization_id = target_organization_id
              AND (u.is_platform_admin OR u.id = actor_user_id)
          ) THEN
            RAISE insufficient_privilege
              USING MESSAGE = 'el despacho incluye una cuenta de plataforma';
          END IF;

          UPDATE organizations SET status = 'closed' WHERE id = target_organization_id;
          UPDATE subscriptions
          SET status = 'canceled', pending_checkout_reference = NULL
          WHERE organization_id = target_organization_id;
          UPDATE invitations SET revoked_at = now()
          WHERE organization_id = target_organization_id
            AND accepted_at IS NULL AND revoked_at IS NULL;
          UPDATE client_portal_accesses SET revoked_at = now()
          WHERE organization_id = target_organization_id AND revoked_at IS NULL;

          v_people := ARRAY(
            SELECT user_id FROM memberships WHERE organization_id = target_organization_id
          );

          DELETE FROM memberships WHERE organization_id = target_organization_id;
          DELETE FROM oauth_identities WHERE user_id IN (SELECT unnest(v_people));
          UPDATE refresh_tokens SET revoked_at = now()
          WHERE user_id IN (SELECT unnest(v_people)) AND revoked_at IS NULL;
          UPDATE users
          SET email = 'closed-' || id::text || '@deleted.invalid',
              full_name = 'Cuenta eliminada',
              password_hash = NULL,
              email_verified_at = NULL,
              security_stamp = gen_random_uuid(),
              status = 'closed',
              updated_at = now()
          WHERE id IN (SELECT unnest(v_people));
          RETURN cardinality(v_people);
        END
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION delete_organization_as_platform(uuid, uuid) FROM PUBLIC")
    op.execute(
        "GRANT EXECUTE ON FUNCTION delete_organization_as_platform(uuid, uuid) TO aletheia_app"
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"),
        "audit_log",
        f"action IN ({_values(_AUDIT_BEFORE + _AUDIT_NEW)})",
    )


def downgrade() -> None:
    op.execute("DELETE FROM audit_log WHERE action = 'organization_deleted_by_platform'")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", f"action IN ({_values(_AUDIT_BEFORE)})"
    )
    op.execute("DROP FUNCTION delete_organization_as_platform(uuid, uuid)")
    op.drop_constraint(op.f("ck_organizations_kind"), "organizations", type_="check")
    op.drop_column("organizations", "kind")
