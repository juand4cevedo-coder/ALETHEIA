"""datos procesales del caso

Revisión: 0014
Anterior: 0013
Creada: 2026-11-10

Agrega a cases tres datos opcionales con que se abre un caso: el radicado (23 dígitos, sin
separadores), el despacho y la especialidad. Es aditiva: las columnas admiten nulo, así que los
casos existentes quedan igual. El radicado no se repite dentro de una organización; los casos sin
radicado no chocan entre sí.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | Sequence[str] | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("cases", sa.Column("filing_number", sa.Text(), nullable=True))
    op.add_column("cases", sa.Column("court", sa.Text(), nullable=True))
    op.add_column("cases", sa.Column("practice_area", sa.Text(), nullable=True))
    op.create_check_constraint(
        op.f("ck_cases_filing_number_format"), "cases", "filing_number ~ '^[0-9]{23}$'"
    )
    op.create_check_constraint(
        op.f("ck_cases_court_length"), "cases", "char_length(court) BETWEEN 1 AND 160"
    )
    op.create_check_constraint(
        op.f("ck_cases_practice_area"),
        "cases",
        "practice_area IN ('civil', 'commercial', 'family', 'labor', 'criminal', "
        "'administrative', 'constitutional', 'other')",
    )
    op.create_index(
        "uq_cases_organization_filing_number",
        "cases",
        ["organization_id", "filing_number"],
        unique=True,
        postgresql_where=sa.text("filing_number IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_cases_organization_filing_number", table_name="cases")
    op.drop_constraint(op.f("ck_cases_practice_area"), "cases", type_="check")
    op.drop_constraint(op.f("ck_cases_court_length"), "cases", type_="check")
    op.drop_constraint(op.f("ck_cases_filing_number_format"), "cases", type_="check")
    op.drop_column("cases", "practice_area")
    op.drop_column("cases", "court")
    op.drop_column("cases", "filing_number")
