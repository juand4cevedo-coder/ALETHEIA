"""anclaje externo de exportaciones

Revisión: 0032
Anterior: 0031

Conserva el token RFC 3161 que cubre la cabeza exacta incluida en cada paquete.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0032"
down_revision: str | Sequence[str] | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("exports", sa.Column("anchor_seq", sa.Integer(), nullable=True))
    op.add_column("exports", sa.Column("anchor_hash", sa.LargeBinary(), nullable=True))
    op.add_column("exports", sa.Column("anchor_token", sa.LargeBinary(), nullable=True))
    op.add_column("exports", sa.Column("anchor_time", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(
        op.f("ck_exports_anchor_complete"),
        "exports",
        "(anchor_seq IS NULL AND anchor_hash IS NULL AND anchor_token IS NULL "
        "AND anchor_time IS NULL) OR (anchor_seq >= 1 AND octet_length(anchor_hash) = 32 "
        "AND octet_length(anchor_token) > 0 AND anchor_time IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_exports_anchor_complete"), "exports", type_="check")
    op.drop_column("exports", "anchor_time")
    op.drop_column("exports", "anchor_token")
    op.drop_column("exports", "anchor_hash")
    op.drop_column("exports", "anchor_seq")
