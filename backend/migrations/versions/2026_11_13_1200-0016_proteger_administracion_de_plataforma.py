"""Reservar el atributo de administración de plataforma al dueño del esquema.

Revisión: 0016
Anterior: 0015
Creada: 2026-11-13

La aplicación puede registrar cuentas y actualizar sus credenciales y aceptación legal, pero
no puede conceder ni retirar is_platform_admin. Esa operación queda fuera de la API pública.
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

revision: str = "0016"
down_revision: str | Sequence[str] | None = "0015"
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
)


def _actions_check(actions: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{action}'" for action in actions) + ")"


def upgrade() -> None:
    op.create_index(
        "uq_users_single_platform_admin",
        "users",
        ["is_platform_admin"],
        unique=True,
        postgresql_where=text("is_platform_admin"),
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"),
        "audit_log",
        _actions_check((*_ACTIONS_BEFORE, "platform_admin_granted")),
    )
    op.execute("REVOKE INSERT, UPDATE ON users FROM aletheia_app")
    op.execute(
        "GRANT INSERT (id, email, email_verified_at, password_hash, full_name, status, "
        "terms_version, privacy_version, consented_at) ON users TO aletheia_app"
    )
    op.execute(
        "GRANT UPDATE (email, password_hash, security_stamp, email_verified_at, status, "
        "terms_version, privacy_version, consented_at, updated_at) "
        "ON users TO aletheia_app"
    )


def downgrade() -> None:
    op.execute("DELETE FROM audit_log WHERE action = 'platform_admin_granted'")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"),
        "audit_log",
        _actions_check(_ACTIONS_BEFORE),
    )
    op.drop_index("uq_users_single_platform_admin", table_name="users")
    op.execute("REVOKE INSERT, UPDATE ON users FROM aletheia_app")
    op.execute("GRANT INSERT, UPDATE ON users TO aletheia_app")
