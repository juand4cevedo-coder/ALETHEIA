"""solicitudes de cotización del plan Corporativo

El formulario público de /empresa deja una solicitud de tipo comercial en la misma bandeja de
soporte de la plataforma. Quien la envía no tiene cuenta, así que la solicitud guarda su nombre y
su correo en columnas propias y no queda ligada a ninguna persona usuaria. Solo la plataforma
la lee; la petición pública puede crearla, pero no leerla después.

Una solicitud comercial no tiene plazo legal: se puede eliminar en cuanto se resuelve, como una
de soporte.

Revision ID: 0065
Revises: 0064
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0065"
down_revision: str | Sequence[str] | None = "0064"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_BEFORE = ("support", "data_query", "data_claim", "consumer", "refund")
_AFTER = (*_BEFORE, "sales")
_OWNER = "EXISTS (SELECT 1 FROM users WHERE id = app_user_id() AND is_platform_admin)"


def _deletable(quick: tuple[str, ...]) -> str:
    listed = ", ".join(f"'{value}'" for value in quick)
    return (
        f"status = 'closed' AND (category IN ({listed}) OR closed_at < now() - interval '3 years')"
    )


def _categories(values: tuple[str, ...]) -> str:
    return "category IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.alter_column("support_tickets", "user_id", nullable=True)
    op.add_column("support_tickets", sa.Column("contact_name", sa.Text(), nullable=True))
    op.add_column("support_tickets", sa.Column("contact_email", sa.Text(), nullable=True))
    op.drop_constraint(op.f("ck_support_tickets_category"), "support_tickets", type_="check")
    op.create_check_constraint(
        op.f("ck_support_tickets_category"), "support_tickets", _categories(_AFTER)
    )
    # Sin cuenta solo se admite una solicitud comercial, y siempre con a quién responder.
    op.create_check_constraint(
        op.f("ck_support_tickets_requester"),
        "support_tickets",
        "user_id IS NOT NULL OR (category = 'sales' AND contact_name IS NOT NULL "
        "AND contact_email IS NOT NULL)",
    )
    op.create_check_constraint(
        op.f("ck_support_tickets_contact_name_length"),
        "support_tickets",
        "char_length(contact_name) BETWEEN 2 AND 120",
    )
    op.create_check_constraint(
        op.f("ck_support_tickets_contact_email_length"),
        "support_tickets",
        "char_length(contact_email) BETWEEN 3 AND 254",
    )
    op.execute(
        "CREATE POLICY ticket_sales_insert ON support_tickets FOR INSERT TO aletheia_app "
        "WITH CHECK (user_id IS NULL AND category = 'sales' AND status = 'open')"
    )
    op.execute("DROP POLICY ticket_platform_delete ON support_tickets")
    op.execute(
        "CREATE POLICY ticket_platform_delete ON support_tickets FOR DELETE TO aletheia_app "
        f"USING ({_OWNER} AND {_deletable(('support', 'sales'))})"
    )


def downgrade() -> None:
    op.execute("DELETE FROM support_tickets WHERE category = 'sales'")
    op.execute("DROP POLICY ticket_platform_delete ON support_tickets")
    op.execute(
        "CREATE POLICY ticket_platform_delete ON support_tickets FOR DELETE TO aletheia_app "
        f"USING ({_OWNER} AND {_deletable(('support',))})"
    )
    op.execute("DROP POLICY ticket_sales_insert ON support_tickets")
    op.drop_constraint(
        op.f("ck_support_tickets_contact_email_length"), "support_tickets", type_="check"
    )
    op.drop_constraint(
        op.f("ck_support_tickets_contact_name_length"), "support_tickets", type_="check"
    )
    op.drop_constraint(op.f("ck_support_tickets_requester"), "support_tickets", type_="check")
    op.drop_constraint(op.f("ck_support_tickets_category"), "support_tickets", type_="check")
    op.create_check_constraint(
        op.f("ck_support_tickets_category"), "support_tickets", _categories(_BEFORE)
    )
    op.drop_column("support_tickets", "contact_email")
    op.drop_column("support_tickets", "contact_name")
    op.alter_column("support_tickets", "user_id", nullable=False)
