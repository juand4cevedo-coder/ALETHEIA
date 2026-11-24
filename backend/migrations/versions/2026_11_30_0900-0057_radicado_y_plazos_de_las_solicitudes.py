"""radicado y plazos legales de las solicitudes; lectura de despachos para la plataforma

Cada solicitud de soporte pasa a tener un tipo (soporte, consulta o reclamo sobre datos
personales, petición o queja de consumidor, reembolso), un número de radicado y el día en que
vence el plazo para responderla, como prometen la política de datos y los términos (Ley 1581 de
2012, arts. 14 y 15; Ley 1480 de 2011, art. 50, literal g).

La cuenta propietaria de la plataforma puede leer los datos de cada despacho (nombre, estado,
almacenamiento y fecha de creación) para su directorio. Sigue sin leer casos ni evidencias.

Revision ID: 0057
Revises: 0056
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0057"
down_revision: str | Sequence[str] | None = "0056"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CATEGORIES = ("support", "data_query", "data_claim", "consumer", "refund")
_OWNER = "EXISTS (SELECT 1 FROM users WHERE id = app_user_id() AND is_platform_admin)"


def upgrade() -> None:
    op.execute("CREATE SEQUENCE support_ticket_filing_seq")
    op.add_column(
        "support_tickets",
        sa.Column("category", sa.Text(), server_default="support", nullable=False),
    )
    op.add_column("support_tickets", sa.Column("filing_number", sa.Text(), nullable=True))
    op.add_column("support_tickets", sa.Column("due_on", sa.Date(), nullable=True))
    # Las solicitudes que ya existen reciben su radicado en orden de llegada y un plazo de
    # quince días calendario, que nunca es más corto que quince días hábiles.
    op.execute(
        """
        UPDATE support_tickets AS t
        SET filing_number = 'PQR-' || extract(year FROM timezone('America/Bogota', t.created_at))
                || '-' || lpad(n.position::text, 5, '0'),
            due_on = (timezone('America/Bogota', t.created_at) + interval '21 days')::date
        FROM (
            SELECT id, nextval('support_ticket_filing_seq') AS position
            FROM (SELECT id FROM support_tickets ORDER BY id) AS ordered
        ) AS n
        WHERE n.id = t.id
        """
    )
    op.alter_column("support_tickets", "filing_number", nullable=False)
    op.alter_column("support_tickets", "due_on", nullable=False)
    op.create_unique_constraint(
        op.f("uq_support_tickets_filing_number"), "support_tickets", ["filing_number"]
    )
    op.create_check_constraint(
        op.f("ck_support_tickets_category"),
        "support_tickets",
        "category IN (" + ", ".join(f"'{value}'" for value in _CATEGORIES) + ")",
    )
    op.create_index("ix_support_tickets_status_due_on", "support_tickets", ["status", "due_on"])
    op.execute("GRANT USAGE ON SEQUENCE support_ticket_filing_seq TO aletheia_app")
    op.execute(
        f"CREATE POLICY platform_read ON organizations FOR SELECT TO aletheia_app USING ({_OWNER})"
    )


def downgrade() -> None:
    op.execute("DROP POLICY platform_read ON organizations")
    op.drop_index("ix_support_tickets_status_due_on", table_name="support_tickets")
    op.drop_constraint(op.f("ck_support_tickets_category"), "support_tickets", type_="check")
    op.drop_constraint(op.f("uq_support_tickets_filing_number"), "support_tickets", type_="unique")
    op.drop_column("support_tickets", "due_on")
    op.drop_column("support_tickets", "filing_number")
    op.drop_column("support_tickets", "category")
    op.execute("DROP SEQUENCE support_ticket_filing_seq")
