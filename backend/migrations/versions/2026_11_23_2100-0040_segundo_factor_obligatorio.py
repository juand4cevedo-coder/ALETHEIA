"""segundo factor obligatorio para el equipo

Política del despacho: si está activa, quien no tenga el segundo factor puede ingresar pero solo
llega a activarlo; nada más del espacio de trabajo le responde hasta que lo haga. Por omisión
está apagada, así que ningún despacho cambia de comportamiento al desplegar.

Revision ID: 0040
Revises: 0039
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0040"
down_revision: str | Sequence[str] | None = "0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("require_two_factor", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("organizations", "require_two_factor")
