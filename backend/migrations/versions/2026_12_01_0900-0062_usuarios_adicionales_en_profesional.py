"""el plan Profesional admite usuarios adicionales a 19.900 pesos al mes

Profesional incluía dos personas y no admitía más, así que un despacho de tres tenía que pasar
a Firma. Ahora cada persona por encima de las dos incluidas vale 19.900 pesos al mes (diez
meses en el pago anual). Solo se cambia si el plan sigue sin adicionales, para no pisar un
ajuste hecho desde la consola.

Revision ID: 0062
Revises: 0061
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0062"
down_revision: str | Sequence[str] | None = "0061"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE plans SET extra_user_price_cop = 19900 "
        "WHERE code = 'professional' AND extra_user_price_cop IS NULL"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE plans SET extra_user_price_cop = NULL "
        "WHERE code = 'professional' AND extra_user_price_cop = 19900"
    )
