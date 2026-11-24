"""plazo de conservación fijo de diez años para todos los despachos

Hasta ahora el propietario de cada despacho podía fijar entre 1 y 30 años de conservación para
sus casos archivados. El plazo pasa a ser el mismo para todos, diez años desde el cierre, como
dicen la política de tratamiento de datos y los términos, y la base no acepta otro valor. Los
casos ya archivados conservan la fecha que se les calculó al cerrarlos.

Revision ID: 0060
Revises: 0059
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0060"
down_revision: str | Sequence[str] | None = "0059"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE organizations SET default_retention_years = 10")
    op.drop_constraint(
        op.f("ck_organizations_default_retention_years"), "organizations", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_organizations_default_retention_years"),
        "organizations",
        "default_retention_years = 10",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("ck_organizations_default_retention_years"), "organizations", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_organizations_default_retention_years"),
        "organizations",
        "default_retention_years BETWEEN 1 AND 30",
    )
