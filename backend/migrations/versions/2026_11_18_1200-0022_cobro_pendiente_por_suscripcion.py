"""Referencia del cobro de Wompi en curso, para no cobrar dos veces la misma suscripción.

Revisión: 0022
Anterior: 0021
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: str | Sequence[str] | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscriptions", sa.Column("pending_checkout_reference", sa.Text(), nullable=True)
    )
    op.create_check_constraint(
        op.f("ck_subscriptions_pending_checkout_reference_length"),
        "subscriptions",
        "char_length(pending_checkout_reference) BETWEEN 1 AND 255",
    )
    op.create_unique_constraint(
        op.f("uq_subscriptions_pending_checkout_reference"),
        "subscriptions",
        ["pending_checkout_reference"],
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("uq_subscriptions_pending_checkout_reference"), "subscriptions", type_="unique"
    )
    op.drop_constraint(
        op.f("ck_subscriptions_pending_checkout_reference_length"), "subscriptions", type_="check"
    )
    op.drop_column("subscriptions", "pending_checkout_reference")
