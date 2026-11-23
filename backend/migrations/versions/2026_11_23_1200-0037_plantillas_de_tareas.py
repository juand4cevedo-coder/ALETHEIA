"""plantillas de tareas

Una plantilla es una lista de tareas que un despacho repite en sus casos, por ejemplo la de un
proceso laboral. Pertenece a la organización, no a un caso: se aísla por organización y la puede
ver quien trabaja en ella. Quien gestiona tareas la crea y la borra; aplicarla a un caso crea
tareas normales, con su responsable y su plazo, y desde ahí siguen su camino de siempre.

Revision ID: 0037
Revises: 0036
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0037"
down_revision: str | Sequence[str] | None = "0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "task_templates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_task_templates")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="RESTRICT",
            name=op.f("fk_task_templates_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_task_templates_created_by_users"),
        ),
        sa.UniqueConstraint(
            "organization_id", "name", name=op.f("uq_task_templates_organization_id_name")
        ),
        sa.UniqueConstraint(
            "organization_id", "id", name=op.f("uq_task_templates_organization_id_id")
        ),
        sa.CheckConstraint(
            "char_length(name) BETWEEN 1 AND 120", name=op.f("ck_task_templates_name")
        ),
    )
    op.create_table(
        "task_template_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", sa.Text(), server_default="normal", nullable=False),
        sa.Column("due_days", sa.SmallInteger(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_task_template_items")),
        sa.ForeignKeyConstraint(
            ["organization_id", "template_id"],
            ["task_templates.organization_id", "task_templates.id"],
            ondelete="CASCADE",
            name=op.f("fk_task_template_items_organization_id_template_id_task_templates"),
        ),
        sa.UniqueConstraint(
            "template_id", "position", name=op.f("uq_task_template_items_template_id_position")
        ),
        sa.CheckConstraint(
            "char_length(title) BETWEEN 1 AND 160", name=op.f("ck_task_template_items_title")
        ),
        sa.CheckConstraint(
            "description IS NULL OR char_length(description) BETWEEN 1 AND 1000",
            name=op.f("ck_task_template_items_description"),
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name=op.f("ck_task_template_items_priority"),
        ),
        sa.CheckConstraint(
            "due_days IS NULL OR due_days BETWEEN 0 AND 365",
            name=op.f("ck_task_template_items_due_days"),
        ),
    )
    op.create_index(
        "ix_task_template_items_template_id_position",
        "task_template_items",
        ["template_id", "position"],
    )
    for table in ("task_templates", "task_template_items"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_isolation ON {table} TO aletheia_app "
            "USING (organization_id = app_organization_id()) "
            "WITH CHECK (organization_id = app_organization_id())"
        )
        op.execute(f"REVOKE ALL ON {table} FROM aletheia_app")
        op.execute(f"GRANT SELECT, INSERT, DELETE ON {table} TO aletheia_app")


def downgrade() -> None:
    op.drop_table("task_template_items")
    op.drop_table("task_templates")
