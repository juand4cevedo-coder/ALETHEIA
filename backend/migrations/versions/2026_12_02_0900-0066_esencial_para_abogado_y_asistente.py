"""Esencial incluye dos usuarios y los demás planes suben un escalón

Esencial era para una sola persona, y casi ningún abogado trabaja sin un asistente. Ahora
incluye dos usuarios sin costo adicional. Para que la escalera siga teniendo sentido, Profesional
pasa de dos a cuatro usuarios, Firma de ocho a diez y la prueba de tres a cuatro, que es lo mismo
que Profesional. Los precios no cambian. Cada plan solo se actualiza si conserva el valor
anterior, para no pisar un ajuste hecho desde la consola.

Revision ID: 0066
Revises: 0065
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0066"
down_revision: str | Sequence[str] | None = "0065"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Código del plan, usuarios incluidos antes y después.
CAMBIOS = (
    ("trial", 3, 4),
    ("essential", 1, 2),
    ("professional", 2, 4),
    ("firm", 8, 10),
)


def upgrade() -> None:
    for codigo, antes, despues in CAMBIOS:
        op.execute(
            f"UPDATE plans SET included_users = {despues} "
            f"WHERE code = '{codigo}' AND included_users = {antes}"
        )


def downgrade() -> None:
    for codigo, antes, despues in CAMBIOS:
        op.execute(
            f"UPDATE plans SET included_users = {antes} "
            f"WHERE code = '{codigo}' AND included_users = {despues}"
        )
