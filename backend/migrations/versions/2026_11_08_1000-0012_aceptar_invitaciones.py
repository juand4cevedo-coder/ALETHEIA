"""aceptar invitaciones

Revisión: 0012
Anterior: 0011
Creada: 2026-11-08

Quien abre el enlace de una invitación todavía no pertenece a ninguna organización, así que
Row-Level Security no le deja ver la fila. invitation_for_token la busca por el SHA-256 del
token, con los permisos del dueño del esquema, y devuelve solo su identificador y el de su
organización. Con eso la aplicación fija el contexto y sigue por las políticas de siempre
(HU-012, ADR-036). Solo la aplicación puede llamarla.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0012"
down_revision: str | Sequence[str] | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION invitation_for_token(p_token_hash bytea)
        RETURNS TABLE (invitation_id uuid, organization_id uuid)
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = public, pg_temp
        AS $$
            SELECT id, organization_id FROM invitations WHERE token_hash = p_token_hash
        $$
        """
    )
    op.execute("GRANT EXECUTE ON FUNCTION invitation_for_token(bytea) TO aletheia_app")


def downgrade() -> None:
    op.execute("DROP FUNCTION invitation_for_token(bytea)")
