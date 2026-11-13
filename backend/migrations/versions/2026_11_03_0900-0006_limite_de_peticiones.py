"""límite de peticiones

Revisión: 0006
Anterior: 0005
Creada: 2026-11-03

Crea la tabla de intentos que alimenta el límite de peticiones de RN-026 y RNF-006: ingreso,
registro, recuperación de contraseña e invitaciones. Es de la plataforma, como jobs, así que
queda fuera de Row-Level Security: se consulta antes de saber a qué organización pertenece
quien llama.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "rate_limit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("bucket", sa.Text(), nullable=False),
        sa.Column("key_hash", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "bucket ~ '^[a-z][a-z_]{0,39}$'", name=op.f("ck_rate_limit_events_bucket_format")
        ),
        sa.CheckConstraint(
            "octet_length(key_hash) = 32", name=op.f("ck_rate_limit_events_key_hash_length")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rate_limit_events")),
    )
    op.create_index(
        "ix_rate_limit_events_bucket_key_hash_created_at",
        "rate_limit_events",
        ["bucket", "key_hash", "created_at"],
        unique=False,
    )

    # Un intento registrado no se corrige: la aplicación lo agrega, lo cuenta y lo borra
    # cuando vence, pero no lo edita.
    op.execute("REVOKE UPDATE ON rate_limit_events FROM aletheia_app")


def downgrade() -> None:
    # Al borrar la tabla desaparecen también sus filas y sus permisos.
    op.drop_index("ix_rate_limit_events_bucket_key_hash_created_at", table_name="rate_limit_events")
    op.drop_table("rate_limit_events")
