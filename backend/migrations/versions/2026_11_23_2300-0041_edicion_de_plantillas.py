"""edición de las plantillas de tareas y su rastro en la auditoría

Una plantilla se puede editar: cambia el nombre y se reemplazan sus tareas en una sola transacción.
La aplicación necesita UPDATE sobre el nombre de la plantilla (las tareas se borran y se vuelven a
insertar, así que ya tenían ese permiso). Crear, editar y borrar una plantilla dejan un evento en
la auditoría del despacho, que verán el propietario y el administrador.

Revision ID: 0041
Revises: 0040
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0041"
down_revision: str | Sequence[str] | None = "0040"
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
    "two_factor_enabled",
    "two_factor_disabled",
    "two_factor_failed",
    "two_factor_recovery_used",
    "two_factor_codes_regenerated",
    "evidence_link_downloaded",
)

_AUDIT_NEW = (
    "task_template_created",
    "task_template_updated",
    "task_template_deleted",
)


def _replace(values: tuple[str, ...]) -> None:
    name = op.f("ck_audit_log_action")
    op.drop_constraint(name, "audit_log", type_="check")
    listed = ", ".join(f"'{value}'" for value in values)
    op.create_check_constraint(name, "audit_log", f"action IN ({listed})")


def upgrade() -> None:
    op.execute("GRANT UPDATE (name) ON task_templates TO aletheia_app")
    _replace((*_AUDIT_BEFORE, *_AUDIT_NEW))


def downgrade() -> None:
    for action in _AUDIT_NEW:
        op.execute(
            sa.text("DELETE FROM audit_log WHERE action = :action").bindparams(action=action)
        )
    _replace(_AUDIT_BEFORE)
    op.execute("REVOKE UPDATE ON task_templates FROM aletheia_app")
