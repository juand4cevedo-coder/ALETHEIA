"""cierre y anonimización de cuenta

Revisión: 0026
Anterior: 0025

Una cuenta cerrada deja de autenticar y su identidad directa se reemplaza por un seudónimo.
La organización de su único propietario también queda cerrada, sin borrar casos ni auditoría.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: str | Sequence[str] | None = "0025"
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
)


def _values(values: tuple[str, ...]) -> str:
    return ", ".join(repr(value) for value in values)


def upgrade() -> None:
    op.drop_constraint(op.f("ck_users_status"), "users", type_="check")
    op.create_check_constraint(
        op.f("ck_users_status"), "users", "status IN ('active', 'blocked', 'closed')"
    )
    op.drop_constraint(op.f("ck_organizations_status"), "organizations", type_="check")
    op.create_check_constraint(
        op.f("ck_organizations_status"),
        "organizations",
        "status IN ('active', 'read_only', 'suspended', 'closed')",
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"),
        "audit_log",
        f"action IN ({_values((*_AUDIT_BEFORE, 'account_closed'))})",
    )
    op.execute(
        """
        CREATE FUNCTION anonymize_own_user(target_user_id uuid) RETURNS void
        LANGUAGE plpgsql SECURITY DEFINER
        SET search_path = public, pg_temp
        AS $$
        BEGIN
          IF target_user_id IS DISTINCT FROM app_user_id() THEN
            RAISE insufficient_privilege USING MESSAGE = 'solo puede cerrar su propia cuenta';
          END IF;
          UPDATE users
          SET email = 'closed-' || id::text || '@deleted.invalid',
              full_name = 'Cuenta cerrada',
              password_hash = NULL,
              email_verified_at = NULL,
              security_stamp = gen_random_uuid(),
              status = 'closed',
              updated_at = now()
          WHERE id = target_user_id AND status = 'active' AND NOT is_platform_admin;
          IF NOT FOUND THEN
            RAISE insufficient_privilege USING MESSAGE = 'la cuenta no se puede cerrar';
          END IF;
        END
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION anonymize_own_user(uuid) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION anonymize_own_user(uuid) TO aletheia_app")


def downgrade() -> None:
    # Permite recuperar de forma segura una instalación donde una ejecución anterior
    # quedó marcada pero la creación de la función se revirtió con la transacción.
    op.execute("DROP FUNCTION IF EXISTS anonymize_own_user(uuid)")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.execute(
        sa.update(sa.table("audit_log", sa.column("action")))
        .where(sa.column("action") == "account_closed")
        .values(action="account_blocked")
    )
    op.create_check_constraint(
        op.f("ck_audit_log_action"),
        "audit_log",
        f"action IN ({_values(_AUDIT_BEFORE)})",
    )
    op.drop_constraint(op.f("ck_organizations_status"), "organizations", type_="check")
    op.execute(
        sa.update(sa.table("organizations", sa.column("status")))
        .where(sa.column("status") == "closed")
        .values(status="suspended")
    )
    op.create_check_constraint(
        op.f("ck_organizations_status"),
        "organizations",
        "status IN ('active', 'read_only', 'suspended')",
    )
    op.drop_constraint(op.f("ck_users_status"), "users", type_="check")
    op.execute(
        sa.update(sa.table("users", sa.column("status")))
        .where(sa.column("status") == "closed")
        .values(status="blocked")
    )
    op.create_check_constraint(op.f("ck_users_status"), "users", "status IN ('active', 'blocked')")
