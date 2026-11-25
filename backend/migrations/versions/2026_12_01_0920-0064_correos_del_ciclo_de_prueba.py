"""correos del ciclo de la prueba gratuita

Durante la prueba, el responsable del despacho recibe cinco correos: la bienvenida (día 0), cómo
subir una evidencia (día 3), cómo invitar al equipo (día 7), cuándo termina la prueba (día 11) y
que la prueba terminó (día 14). La tabla guarda cada etapa que ya le tocó a una organización:
su llave primaria impide enviar dos veces el mismo correo.

El trabajador recorre las pruebas de todos los despachos, que la seguridad por filas no le deja
ver. Una función con los permisos del dueño del esquema le entrega solo lo necesario: qué
organizaciones siguen en prueba sin haber pagado, quién es su responsable y qué etapas ya
recibió. No entrega nombres, correos ni contenido de casos.

Revision ID: 0064
Revises: 0063
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0064"
down_revision: str | Sequence[str] | None = "0063"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_STAGES = ("day_0", "day_3", "day_7", "day_11", "day_14")


def upgrade() -> None:
    op.create_table(
        "trial_emails",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("stage", sa.Text(), nullable=False),
        sa.Column("emailed", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("organization_id", "stage", name=op.f("pk_trial_emails")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
            name=op.f("fk_trial_emails_organization_id_organizations"),
        ),
        sa.CheckConstraint(
            "stage IN (" + ", ".join(f"'{stage}'" for stage in _STAGES) + ")",
            name=op.f("ck_trial_emails_stage"),
        ),
    )
    op.execute("ALTER TABLE trial_emails ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY trial_emails_isolation ON trial_emails TO aletheia_app "
        "USING (organization_id = app_organization_id()) "
        "WITH CHECK (organization_id = app_organization_id())"
    )
    # Lo enviado no se edita ni se borra: así ningún correo sale dos veces.
    op.execute("REVOKE ALL ON trial_emails FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT ON trial_emails TO aletheia_app")
    op.execute(
        """
        CREATE FUNCTION trial_email_candidates()
        RETURNS TABLE (
          organization_id uuid,
          owner_id uuid,
          started_at timestamptz,
          trial_ends_at timestamptz,
          sent text[]
        )
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public, pg_temp
        AS $$
          SELECT s.organization_id,
                 m.user_id,
                 o.created_at,
                 s.trial_ends_at,
                 coalesce(
                   (SELECT array_agg(t.stage) FROM trial_emails t
                    WHERE t.organization_id = s.organization_id),
                   ARRAY[]::text[]
                 )
          FROM subscriptions s
          JOIN organizations o ON o.id = s.organization_id
          JOIN memberships m ON m.organization_id = s.organization_id AND m.role = 'owner'
          JOIN users u ON u.id = m.user_id
          WHERE s.access_source = 'trial'
            AND s.status IN ('trial', 'expired')
            AND s.trial_ends_at IS NOT NULL
            AND s.trial_ends_at > now() - interval '3 days'
            AND o.status IN ('active', 'read_only')
            AND u.status = 'active'
            AND u.email_verified_at IS NOT NULL
            AND NOT u.is_platform_admin
            AND NOT EXISTS (
              SELECT 1 FROM payment_receipts r WHERE r.organization_id = s.organization_id
            )
            AND NOT EXISTS (
              SELECT 1 FROM trial_emails t
              WHERE t.organization_id = s.organization_id AND t.stage = 'day_14'
            )
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION trial_email_candidates() FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION trial_email_candidates() TO aletheia_app")


def downgrade() -> None:
    op.execute("DROP FUNCTION trial_email_candidates()")
    op.drop_table("trial_emails")
