"""auditoría de casos

Revisión: 0015
Anterior: 0014
Creada: 2026-11-10

Agrega case_created a la lista cerrada de eventos de la auditoría. Abrir un caso (HU-015) queda
registrado en la auditoría de la organización, además de iniciar la cadena de custodia del caso
con su propio evento case_created: la cadena prueba la historia del caso y la auditoría responde
quién lo abrió, desde qué IP y con qué navegador (RN-027).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0015"
down_revision: str | Sequence[str] | None = "0014"
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
)
_ACTIONS_AFTER = (*_ACTIONS_BEFORE, "case_created")


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
    op.execute("DELETE FROM audit_log WHERE action = 'case_created'")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _in("action", _ACTIONS_BEFORE)
    )
