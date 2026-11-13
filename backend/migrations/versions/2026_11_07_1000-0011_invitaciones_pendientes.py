"""invitaciones pendientes

Revisión: 0011
Anterior: 0010
Creada: 2026-11-07

Índice parcial de las invitaciones que siguen abiertas: ni aceptadas ni revocadas. Con él se
cuentan los cupos ocupados del plan y se busca si un correo ya tiene una invitación vigente sin
recorrer las aceptadas o revocadas, que son la mayoría con el tiempo (HU-011).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_invitations_organization_id_pending",
        "invitations",
        ["organization_id"],
        unique=False,
        postgresql_where=sa.text("accepted_at IS NULL AND revoked_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_invitations_organization_id_pending",
        table_name="invitations",
        postgresql_where=sa.text("accepted_at IS NULL AND revoked_at IS NULL"),
    )
