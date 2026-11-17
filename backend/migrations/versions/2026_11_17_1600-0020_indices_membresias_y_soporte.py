"""Índices para membresías por organización y solicitudes de soporte por persona.

Revisión: 0020
Anterior: 0019
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0020"
down_revision: str | Sequence[str] | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        op.f("ix_memberships_organization_id"), "memberships", ["organization_id"]
    )
    op.create_index(
        op.f("ix_support_tickets_user_id_id"), "support_tickets", ["user_id", "id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_support_tickets_user_id_id"), "support_tickets")
    op.drop_index(op.f("ix_memberships_organization_id"), "memberships")
