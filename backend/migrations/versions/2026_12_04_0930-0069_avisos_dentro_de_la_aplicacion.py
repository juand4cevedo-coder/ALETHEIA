"""avisos dentro de la aplicación: la campana y su panel

Cada aviso es de una persona en un despacho. Bajo Row-Level Security, cualquiera del despacho
puede dejarle un aviso a un colega (por ejemplo, al asignarle una tarea), pero solo la persona
destinataria lo ve y lo marca como leído (ADR-063).

Revision ID: 0069
Revises: 0068
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0069"
down_revision: str | Sequence[str] | None = "0068"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_KINDS = ("task_assigned", "case_member_added", "client_message", "member_joined")


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("link", sa.Text(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
            name=op.f("fk_notifications_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
            name=op.f("fk_notifications_user_id_users"),
        ),
        sa.CheckConstraint(
            "kind IN (" + ", ".join(f"'{kind}'" for kind in _KINDS) + ")",
            name=op.f("ck_notifications_kind"),
        ),
        sa.CheckConstraint(
            "char_length(title) BETWEEN 1 AND 160", name=op.f("ck_notifications_title_length")
        ),
        sa.CheckConstraint(
            "body IS NULL OR char_length(body) BETWEEN 1 AND 300",
            name=op.f("ck_notifications_body_length"),
        ),
        sa.CheckConstraint(
            "char_length(link) BETWEEN 1 AND 300 AND link LIKE '/app%'",
            name=op.f("ck_notifications_link"),
        ),
    )
    op.create_index(
        "ix_notifications_user_id_created_at",
        "notifications",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_notifications_unread",
        "notifications",
        ["user_id"],
        postgresql_where=sa.text("read_at IS NULL"),
    )
    op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY")
    # Dejar un aviso: dentro del despacho de la sesión.
    op.execute(
        "CREATE POLICY notifications_insert ON notifications FOR INSERT TO aletheia_app "
        "WITH CHECK (organization_id = app_organization_id())"
    )
    # Verlo y marcarlo como leído: solo la persona destinataria, en ese despacho.
    op.execute(
        "CREATE POLICY notifications_owner ON notifications FOR SELECT TO aletheia_app "
        "USING (organization_id = app_organization_id() AND user_id = app_user_id())"
    )
    op.execute(
        "CREATE POLICY notifications_read ON notifications FOR UPDATE TO aletheia_app "
        "USING (organization_id = app_organization_id() AND user_id = app_user_id()) "
        "WITH CHECK (organization_id = app_organization_id() AND user_id = app_user_id())"
    )
    op.execute("REVOKE ALL ON notifications FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT ON notifications TO aletheia_app")
    # Solo se marca la lectura: el texto y el destinatario no cambian.
    op.execute("GRANT UPDATE (read_at) ON notifications TO aletheia_app")
    # El mantenimiento del trabajador corre sin despacho: borra los avisos viejos con una función
    # del dueño del esquema que solo hace eso. Leídos, a los 90 días; sin leer, al año.
    op.execute(
        """
        CREATE FUNCTION purge_old_notifications() RETURNS integer
        LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
            WITH borrados AS (
                DELETE FROM notifications
                WHERE (read_at IS NOT NULL AND read_at < now() - interval '90 days')
                   OR created_at < now() - interval '365 days'
                RETURNING 1
            )
            SELECT count(*)::integer FROM borrados
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION purge_old_notifications() FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION purge_old_notifications() TO aletheia_app")


def downgrade() -> None:
    op.execute("DROP FUNCTION purge_old_notifications()")
    op.drop_table("notifications")
