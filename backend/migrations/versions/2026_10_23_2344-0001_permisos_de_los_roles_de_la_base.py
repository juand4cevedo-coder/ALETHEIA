"""permisos de los roles de la base

Revisión: 0001
Anterior: ninguna
Creada: 2026-10-23

Los usuarios aletheia_owner, aletheia_app y aletheia_support los crea antes un administrador
con infra/postgres/bootstrap.sql. Esta migración corre como aletheia_owner y define qué
recibe cada uno sobre todo lo que el dueño cree de aquí en adelante.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # La aplicación lee y escribe filas en cada tabla nueva; nunca crea ni altera tablas.
    # Las tablas con reglas más estrictas, como la cadena de custodia, le quitan permisos
    # en su propia migración.
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE aletheia_owner IN SCHEMA public "
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aletheia_app"
    )
    # Soporte solo consulta.
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE aletheia_owner IN SCHEMA public "
        "GRANT SELECT ON TABLES TO aletheia_support"
    )
    # PostgreSQL deja ejecutar cualquier función nueva a todos los usuarios. Aquí ninguna
    # función nace ejecutable: cada una se concede a propósito a quien la necesita.
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE aletheia_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC"
    )


def downgrade() -> None:
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE aletheia_owner GRANT EXECUTE ON FUNCTIONS TO PUBLIC"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE aletheia_owner IN SCHEMA public "
        "REVOKE SELECT ON TABLES FROM aletheia_support"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE aletheia_owner IN SCHEMA public "
        "REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM aletheia_app"
    )
