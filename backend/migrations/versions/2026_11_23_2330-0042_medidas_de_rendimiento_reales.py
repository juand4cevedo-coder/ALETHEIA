"""medidas de rendimiento reales

Revisión: 0042
Anterior: 0041
Creada: 2026-11-23

Crea web_vitals, donde la interfaz entrega las medidas de rendimiento de quienes aceptaron las
cookies de analítica (ADR-052). Es de la plataforma, como rate_limit_events: sin Row-Level
Security, porque ninguna fila pertenece a un despacho ni a una persona. No guarda cuenta, sesión,
IP ni navegador.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0042"
down_revision: str | Sequence[str] | None = "0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "web_vitals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("metric", sa.Text(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("page", sa.Text(), nullable=False),
        sa.Column("device", sa.Text(), nullable=False),
        sa.Column("connection", sa.Text(), nullable=True),
        sa.Column("version", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "metric IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')", name=op.f("ck_web_vitals_metric")
        ),
        sa.CheckConstraint(
            "page IN ('inicio', 'precios', 'ingreso', 'documentacion', 'legal', 'espacio', 'otra')",
            name=op.f("ck_web_vitals_page"),
        ),
        sa.CheckConstraint("device IN ('movil', 'escritorio')", name=op.f("ck_web_vitals_device")),
        sa.CheckConstraint(
            "connection IS NULL OR connection IN ('slow-2g', '2g', '3g', '4g')",
            name=op.f("ck_web_vitals_connection"),
        ),
        sa.CheckConstraint(
            "value >= 0 AND value <= 600000", name=op.f("ck_web_vitals_value_range")
        ),
        sa.CheckConstraint(
            "version ~ '^[0-9]+\\.[0-9]+\\.[0-9]+$'", name=op.f("ck_web_vitals_version_format")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_web_vitals")),
    )
    op.create_index(
        "ix_web_vitals_created_at_metric", "web_vitals", ["created_at", "metric"], unique=False
    )

    # Una medida entregada no se corrige: la aplicación la agrega, la consulta y la borra al
    # vencer, pero no la edita.
    op.execute("REVOKE UPDATE ON web_vitals FROM aletheia_app")


def downgrade() -> None:
    op.drop_index("ix_web_vitals_created_at_metric", table_name="web_vitals")
    op.drop_table("web_vitals")
