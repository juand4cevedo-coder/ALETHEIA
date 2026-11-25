"""verificación de persona en los formularios de acceso

Ingresar, crear una cuenta, recuperar la contraseña y reenviar la verificación exigen resolver
un reto de prueba de trabajo firmado por la API (services/captcha.py). Esta tabla guarda el
resumen de cada reto ya usado hasta que vence, para que una solución no se pueda reutilizar.

Revision ID: 0061
Revises: 0060
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0061"
down_revision: str | Sequence[str] | None = "0060"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "captcha_solutions",
        sa.Column("challenge_hash", sa.LargeBinary(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("challenge_hash", name=op.f("pk_captcha_solutions")),
        sa.CheckConstraint(
            "octet_length(challenge_hash) = 32",
            name=op.f("ck_captcha_solutions_challenge_hash_length"),
        ),
    )
    op.create_index(op.f("ix_captcha_solutions_expires_at"), "captcha_solutions", ["expires_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_captcha_solutions_expires_at"), table_name="captcha_solutions")
    op.drop_table("captcha_solutions")
