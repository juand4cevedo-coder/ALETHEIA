"""una identidad de Google por cuenta

Revisión: 0025
Anterior: 0024

Una cuenta de Aletheia puede vincular una sola identidad de Google. El índice existente ya
impide que la misma identidad pertenezca a dos cuentas; este completa la relación uno a uno.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0025"
down_revision: str | Sequence[str] | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "uq_oauth_identities_provider_user",
        "oauth_identities",
        ["provider", "user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_oauth_identities_provider_user", table_name="oauth_identities")
