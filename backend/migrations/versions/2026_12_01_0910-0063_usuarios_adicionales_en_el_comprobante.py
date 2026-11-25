"""usuarios adicionales en el comprobante de pago

El cobro suma al precio del plan las personas por encima de las incluidas. El comprobante
guarda cuántas fueron y cuánto sumaron, para mostrarlas en una línea propia. Los comprobantes
anteriores quedan con cero: entonces nunca se cobraron adicionales.

Revision ID: 0063
Revises: 0062
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0063"
down_revision: str | Sequence[str] | None = "0062"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "payment_receipts",
        sa.Column("extra_users", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "payment_receipts",
        sa.Column("extra_users_cop", sa.BigInteger(), server_default="0", nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_payment_receipts_extra_users"), "payment_receipts", "extra_users >= 0"
    )
    op.create_check_constraint(
        op.f("ck_payment_receipts_extra_users_cop"),
        "payment_receipts",
        "extra_users_cop >= 0 AND extra_users_cop < amount_cop",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("ck_payment_receipts_extra_users_cop"), "payment_receipts", type_="check"
    )
    op.drop_constraint(op.f("ck_payment_receipts_extra_users"), "payment_receipts", type_="check")
    op.drop_column("payment_receipts", "extra_users_cop")
    op.drop_column("payment_receipts", "extra_users")
