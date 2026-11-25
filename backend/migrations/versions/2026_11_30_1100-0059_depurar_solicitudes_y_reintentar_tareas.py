"""eliminar solicitudes resueltas y reintentar tareas desde la consola de la plataforma

La cuenta propietaria puede borrar una solicitud resuelta para no acumular registros que ya no
sirven. La base decide qué se puede borrar: una de ayuda con el servicio, apenas se resuelve;
una consulta o reclamo sobre datos personales, una queja de consumidor o un reembolso, solo tres
años después de cerrada, el plazo que tiene la autoridad para sancionar (Ley 1437 de 2011,
art. 52). Así la prueba de lo que se respondió existe mientras pueda pedirse.

También puede devolver a la cola una tarea que el trabajador enterró tras agotar sus intentos.
Las dos acciones quedan en la auditoría.

Revision ID: 0059
Revises: 0058
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0059"
down_revision: str | Sequence[str] | None = "0058"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_OWNER = "EXISTS (SELECT 1 FROM users WHERE id = app_user_id() AND is_platform_admin)"
_DELETABLE = (
    "status = 'closed' AND (category = 'support' OR closed_at < now() - interval '3 years')"
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
)
_AUDIT_NEW = ("support_ticket_deleted", "platform_job_retried")


def _values(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


def upgrade() -> None:
    op.execute("GRANT DELETE ON support_tickets TO aletheia_app")
    op.execute(
        "CREATE POLICY ticket_platform_delete ON support_tickets FOR DELETE TO aletheia_app "
        f"USING ({_OWNER} AND {_DELETABLE})"
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"),
        "audit_log",
        f"action IN ({_values(_AUDIT_BEFORE + _AUDIT_NEW)})",
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM audit_log WHERE action IN ('support_ticket_deleted', 'platform_job_retried')"
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", f"action IN ({_values(_AUDIT_BEFORE)})"
    )
    op.execute("DROP POLICY ticket_platform_delete ON support_tickets")
    op.execute("REVOKE DELETE ON support_tickets FROM aletheia_app")
