"""sello de seguridad de la cuenta

Revisión: 0010
Anterior: 0009
Creada: 2026-11-06

Agrega users.security_stamp, un valor aleatorio que la aplicación cambia cada vez que cambian
las credenciales de la cuenta. Los enlaces de recuperación de la contraseña lo llevan sellado
en lugar del hash de la contraseña, así que ningún token depende de ese hash. Cada cuenta
existente recibe uno propio al aplicar la migración.

Soporte no lo lee: no está entre las columnas de users que se le conceden.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "security_stamp",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "security_stamp")
