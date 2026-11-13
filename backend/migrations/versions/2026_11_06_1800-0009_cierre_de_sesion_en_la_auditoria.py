"""cierre de sesión en la auditoría

Revisión: 0009
Anterior: 0008
Creada: 2026-11-06

Agrega logout a la lista cerrada de eventos de la auditoría. Cerrar la sesión de un
dispositivo (API-009) queda registrado aparte de cerrar todas las sesiones, que ya tenía su
evento (sessions_revoked): en la auditoría de la organización (HU-014) son hechos distintos.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
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
)
_ACTIONS_AFTER = (*_ACTIONS_BEFORE, "logout")


def _in(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({quoted})"


def upgrade() -> None:
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _in("action", _ACTIONS_AFTER)
    )


def downgrade() -> None:
    # La auditoría no se edita desde la aplicación; bajar esta revisión es una operación del
    # dueño del esquema, y los eventos que ya no caben en la lista se van con ella.
    op.execute("DELETE FROM audit_log WHERE action = 'logout'")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _in("action", _ACTIONS_BEFORE)
    )
