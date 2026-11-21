"""índices de filtros de auditoría

Revisión: 0027
Anterior: 0026

Los filtros por acción y persona conservan el prefijo de organización y la fecha para que
PostgreSQL resuelva el periodo y el orden sin recorrer la auditoría completa del despacho.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0027"
down_revision: str | Sequence[str] | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_audit_log_organization_action_created_at",
        "audit_log",
        ["organization_id", "action", "created_at"],
    )
    op.create_index(
        "ix_audit_log_organization_actor_created_at",
        "audit_log",
        ["organization_id", "actor_user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_log_organization_actor_created_at", table_name="audit_log")
    op.drop_index("ix_audit_log_organization_action_created_at", table_name="audit_log")
