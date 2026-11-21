"""índice de la bandeja de tareas

Revisión: 0031
Anterior: 0030

Acelera la consulta transversal de trabajo activo por despacho, estado y fecha límite.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0031"
down_revision: str | Sequence[str] | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_case_tasks_organization_status_due_at",
        "case_tasks",
        ["organization_id", "status", "due_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_case_tasks_organization_status_due_at", table_name="case_tasks")
