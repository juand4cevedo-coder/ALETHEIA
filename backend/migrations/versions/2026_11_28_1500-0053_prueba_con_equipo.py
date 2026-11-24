"""la prueba gratuita incluye tres personas

Con una sola persona incluida, quien abría una cuenta independiente no podía invitar a nadie y
no tenía forma de probar el equipo (abogados, asistentes, casos asignados) antes de pagar. La
prueba pasa a incluir tres: el responsable, un abogado y un asistente. Solo se cambia si el
plan sigue con el valor de origen, para no pisar un ajuste hecho a mano.

Revision ID: 0053
Revises: 0052
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0053"
down_revision: str | Sequence[str] | None = "0052"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE plans SET included_users = 3 WHERE code = 'trial' AND included_users = 1")


def downgrade() -> None:
    op.execute("UPDATE plans SET included_users = 1 WHERE code = 'trial' AND included_users = 3")
