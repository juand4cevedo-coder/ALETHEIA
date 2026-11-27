"""cada plan admite adicionales hasta un tope y Corporativo no tiene límite de personas

Esencial, Profesional y Firma admiten personas adicionales a 19.900 pesos al mes, hasta tantas
como las que incluyen: Esencial llega a 4, Profesional a 8 y Firma a 20. Más allá hay que subir
de plan. Firma cobraba 14.900 por adicional y pasa a 19.900, como los demás. Corporativo, que
se vende por cotización, no tiene tope: sus adicionales no se cobran aparte (precio 0) porque el
valor se acuerda con cada cliente. La prueba sigue sin adicionales.

Cada plan solo se actualiza si conserva el valor anterior, para no pisar un ajuste hecho desde
la consola.

Revision ID: 0068
Revises: 0067
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0068"
down_revision: str | Sequence[str] | None = "0067"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PRECIO_ADICIONAL = 19_900


def upgrade() -> None:
    op.add_column("plans", sa.Column("max_extra_users", sa.Integer(), nullable=True))
    op.create_check_constraint(op.f("ck_plans_max_extra_users"), "plans", "max_extra_users >= 0")
    op.execute(
        sa.text(
            "UPDATE plans SET extra_user_price_cop = :precio "
            "WHERE (code = 'essential' AND extra_user_price_cop IS NULL) "
            "OR (code = 'firm' AND extra_user_price_cop = 14900)"
        ).bindparams(precio=PRECIO_ADICIONAL)
    )
    op.execute(
        "UPDATE plans SET max_extra_users = included_users "
        "WHERE code IN ('essential', 'professional', 'firm')"
    )
    op.execute(
        "UPDATE plans SET extra_user_price_cop = 0, max_extra_users = NULL "
        "WHERE code = 'corporate' AND extra_user_price_cop IS NULL"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE plans SET extra_user_price_cop = NULL "
        "WHERE code = 'corporate' AND extra_user_price_cop = 0"
    )
    op.execute(
        sa.text(
            "UPDATE plans SET extra_user_price_cop = NULL "
            "WHERE code = 'essential' AND extra_user_price_cop = :precio"
        ).bindparams(precio=PRECIO_ADICIONAL)
    )
    op.drop_constraint(op.f("ck_plans_max_extra_users"), "plans", type_="check")
    op.drop_column("plans", "max_extra_users")
