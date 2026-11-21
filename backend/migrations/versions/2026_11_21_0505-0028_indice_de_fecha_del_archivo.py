"""índice de fecha del archivo

Revisión: 0028
Anterior: 0027

Permite recorrer los casos cerrados de un despacho por su fecha de cierre sin examinar los
casos abiertos ni el archivo completo.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0028"
down_revision: str | Sequence[str] | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_cases_organization_id_status_closed_at",
        "cases",
        ["organization_id", "status", "closed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_cases_organization_id_status_closed_at", table_name="cases")
