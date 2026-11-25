"""borrar la IP y el navegador del registro de seguridad a los 90 días

La política de tratamiento de datos promete que la dirección IP y el navegador de los registros
de seguridad se anonimizan a los 90 días (RN-027). La aplicación no puede modificar el registro
de auditoría, así que lo hace una función con los permisos del dueño del esquema que solo borra
esos dos datos de los eventos vencidos y nada más. El trabajador la llama en su mantenimiento.

Revision ID: 0058
Revises: 0057
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0058"
down_revision: str | Sequence[str] | None = "0057"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION anonymize_expired_audit_network() RETURNS integer
        LANGUAGE plpgsql SECURITY DEFINER
        SET search_path = public, pg_temp
        AS $$
        DECLARE
          cleared integer;
        BEGIN
          UPDATE audit_log
          SET ip = NULL, user_agent = NULL
          WHERE created_at < now() - interval '90 days'
            AND (ip IS NOT NULL OR user_agent IS NOT NULL);
          GET DIAGNOSTICS cleared = ROW_COUNT;
          RETURN cleared;
        END
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION anonymize_expired_audit_network() FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION anonymize_expired_audit_network() TO aletheia_app")
    # El borrado recorre por fecha: el índice parcial deja fuera lo ya anonimizado.
    op.execute(
        "CREATE INDEX ix_audit_log_created_at_with_network ON audit_log (created_at) "
        "WHERE ip IS NOT NULL OR user_agent IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX ix_audit_log_created_at_with_network")
    op.execute("DROP FUNCTION anonymize_expired_audit_network()")
