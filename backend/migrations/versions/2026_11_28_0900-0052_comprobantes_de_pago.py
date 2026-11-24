"""comprobantes de pago de ALETHEIA

Cada pago aprobado deja un comprobante propio, numerado en orden y descargable en PDF. Es el
documento que ALETHEIA entrega por sus cobros mientras el operador no está obligado a expedir
factura electrónica. El comprobante vive en la organización, bajo Row-Level Security; la
plataforma lo lee para sumar lo cobrado en el año.

Revision ID: 0052
Revises: 0051
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0052"
down_revision: str | Sequence[str] | None = "0051"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_PLATFORM = "EXISTS (SELECT 1 FROM users WHERE id = app_user_id() AND is_platform_admin)"


def upgrade() -> None:
    op.execute("CREATE SEQUENCE payment_receipt_seq")
    op.create_table(
        "payment_receipts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("payment_event_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.Text(), nullable=False),
        sa.Column("gateway_transaction_id", sa.Text(), nullable=False),
        sa.Column("payment_method", sa.Text(), nullable=True),
        sa.Column("amount_cop", sa.BigInteger(), nullable=False),
        sa.Column("plan_name", sa.Text(), nullable=False),
        sa.Column("billing_cycle", sa.Text(), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("buyer_name", sa.Text(), nullable=False),
        sa.Column("buyer_email", sa.Text(), nullable=True),
        sa.Column(
            "issued_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment_receipts")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="RESTRICT",
            name=op.f("fk_payment_receipts_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["payment_event_id"],
            ["payment_events.id"],
            ondelete="RESTRICT",
            name=op.f("fk_payment_receipts_payment_event_id_payment_events"),
        ),
        sa.UniqueConstraint("number", name=op.f("uq_payment_receipts_number")),
        sa.UniqueConstraint("payment_event_id", name=op.f("uq_payment_receipts_payment_event_id")),
        sa.CheckConstraint("amount_cop > 0", name=op.f("ck_payment_receipts_amount_cop")),
        sa.CheckConstraint(
            "billing_cycle IN ('monthly', 'annual')",
            name=op.f("ck_payment_receipts_billing_cycle"),
        ),
        sa.CheckConstraint(
            "char_length(number) BETWEEN 1 AND 30", name=op.f("ck_payment_receipts_number")
        ),
    )
    op.create_index(
        "ix_payment_receipts_organization_id_issued_at",
        "payment_receipts",
        ["organization_id", "issued_at"],
    )
    op.execute("ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY payment_receipts_isolation ON payment_receipts TO aletheia_app "
        "USING (organization_id = app_organization_id()) "
        "WITH CHECK (organization_id = app_organization_id())"
    )
    op.execute(
        "CREATE POLICY platform_read ON payment_receipts FOR SELECT TO aletheia_app "
        f"USING ({_PLATFORM})"
    )
    # Un comprobante emitido no se edita ni se borra: solo se agrega.
    op.execute("REVOKE ALL ON payment_receipts FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT ON payment_receipts TO aletheia_app")
    op.execute("GRANT USAGE ON SEQUENCE payment_receipt_seq TO aletheia_app")


def downgrade() -> None:
    op.drop_table("payment_receipts")
    op.execute("DROP SEQUENCE payment_receipt_seq")
