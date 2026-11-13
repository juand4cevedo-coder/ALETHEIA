"""aceptación de los textos legales

Revisión: 0008
Anterior: 0007
Creada: 2026-11-06

Crea legal_acceptances (DAT-20), la prueba de cada aceptación de los textos legales: al crear
la cuenta y cada vez que la persona acepta unos textos nuevos. users sigue guardando la
aceptación vigente; esta tabla las guarda todas y no se edita ni se borra desde la aplicación.
Copia como primera aceptación la que ya tenía cada cuenta, y agrega legal_accepted a la lista
cerrada de eventos de la auditoría.

Es de la plataforma, como users: queda fuera de Row-Level Security y el usuario de soporte no
la lee.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
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
)
_ACTIONS_AFTER = (*_ACTIONS_BEFORE, "legal_accepted")


def _in(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({quoted})"


def upgrade() -> None:
    op.create_table(
        "legal_acceptances",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("context", sa.Text(), nullable=False),
        sa.Column(
            "accepted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(version) BETWEEN 1 AND 20",
            name=op.f("ck_legal_acceptances_version_length"),
        ),
        sa.CheckConstraint(
            "context IN ('registration', 'renewal')", name=op.f("ck_legal_acceptances_context")
        ),
        sa.CheckConstraint(
            "char_length(email) <= 254", name=op.f("ck_legal_acceptances_email_length")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_legal_acceptances_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_legal_acceptances")),
    )
    op.create_index(
        "ix_legal_acceptances_user_id_accepted_at",
        "legal_acceptances",
        ["user_id", "accepted_at"],
        unique=False,
    )

    # Cada cuenta ya aceptó unos textos al registrarse: esa es su primera prueba. El id es un
    # UUID aleatorio porque la base no genera v7; las filas nuevas las numera la aplicación.
    op.execute(
        "INSERT INTO legal_acceptances (id, user_id, email, version, context, accepted_at) "
        "SELECT gen_random_uuid(), id, email, terms_version, 'registration', consented_at "
        "FROM users"
    )

    # Una prueba no se corrige ni se borra. La llave pasa a nulo cuando se elimina la cuenta,
    # pero eso lo hace PostgreSQL con los permisos del dueño de la tabla.
    op.execute("REVOKE UPDATE, DELETE ON legal_acceptances FROM aletheia_app")
    op.execute("REVOKE SELECT ON legal_acceptances FROM aletheia_support")

    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _in("action", _ACTIONS_AFTER)
    )


def downgrade() -> None:
    op.execute("DELETE FROM audit_log WHERE action = 'legal_accepted'")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _in("action", _ACTIONS_BEFORE)
    )
    op.drop_index("ix_legal_acceptances_user_id_accepted_at", table_name="legal_acceptances")
    op.drop_table("legal_acceptances")
