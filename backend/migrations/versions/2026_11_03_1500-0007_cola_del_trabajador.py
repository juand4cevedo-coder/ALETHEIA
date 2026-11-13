"""cola del trabajador

Revisión: 0007
Anterior: 0006
Creada: 2026-11-03

El trabajador busca en una sola consulta las tareas en cola y las que quedaron en curso con
la reserva vencida, porque el proceso que las tomó se cayó. El índice parcial de la migración
0003 solo cubría las tareas en cola; este cubre ambas y sigue sin incluir las terminadas.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_jobs_run_after_queued", table_name="jobs")
    op.create_index(
        "ix_jobs_run_after_pending",
        "jobs",
        ["run_after"],
        unique=False,
        postgresql_where=sa.text("status IN ('queued', 'running')"),
    )


def downgrade() -> None:
    op.drop_index("ix_jobs_run_after_pending", table_name="jobs")
    op.create_index(
        "ix_jobs_run_after_queued",
        "jobs",
        ["run_after"],
        unique=False,
        postgresql_where=sa.text("status = 'queued'"),
    )
