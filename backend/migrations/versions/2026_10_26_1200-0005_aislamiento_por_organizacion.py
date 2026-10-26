"""aislamiento por organización

Revisión: 0005
Anterior: 0004
Creada: 2026-10-26

Activa Row-Level Security en las tablas que pertenecen a una organización. Cada transacción
de la aplicación fija con set_config la organización y la persona que consultan; PostgreSQL
solo deja ver y escribir las filas de esa organización. Sin contexto no hay filas: se niega
por defecto (SEC-001).

Quedan fuera las tablas que no pertenecen a una organización: users, oauth_identities y
refresh_tokens se consultan antes de conocerla, al ingresar; plans es el catálogo público, y
payment_events y jobs son de la plataforma. El dueño del esquema no queda sujeto a las
políticas, así que las migraciones y las funciones SECURITY DEFINER ven todas las filas.
"""

from collections.abc import Sequence
from typing import Final

from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ROLES: Final = "aletheia_app, aletheia_support"

# Tablas con organization_id cuya política es la misma para leer y escribir.
_ORGANIZATION_TABLES: Final = (
    "invitations",
    "subscriptions",
    "cases",
    "case_members",
    "evidences",
    "custody_events",
    "exports",
    "deletion_records",
)

# purge_case de la migración 0004, con un hueco para la comprobación de organización.
_PURGE_CASE: Final = """
CREATE OR REPLACE FUNCTION purge_case(
    p_case_id uuid,
    p_record_id uuid,
    p_requested_by uuid,
    p_backup_retention interval
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_organization uuid;
    v_status text;
    v_existing uuid;
    v_count integer;
    v_bytes bigint;
    v_hashes jsonb;
BEGIN
    IF p_backup_retention <= interval '0' THEN
        RAISE EXCEPTION 'La retención de respaldos debe ser positiva'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT organization_id, status INTO v_organization, v_status
    FROM cases WHERE id = p_case_id{same_organization} FOR UPDATE;
    IF NOT FOUND THEN
        SELECT id INTO v_existing
        FROM deletion_records WHERE case_id = p_case_id{same_organization};
        IF FOUND THEN
            RETURN v_existing;
        END IF;
        RAISE EXCEPTION 'El caso % no existe', p_case_id USING ERRCODE = 'no_data_found';
    END IF;
    IF v_status <> 'deleting' THEN
        RAISE EXCEPTION 'El caso % no está marcado para eliminar', p_case_id
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;

    SELECT count(*),
           coalesce(sum(size_bytes), 0),
           coalesce(jsonb_agg(encode(sha256, 'hex') ORDER BY id), '[]'::jsonb)
    INTO v_count, v_bytes, v_hashes
    FROM evidences WHERE case_id = p_case_id;

    INSERT INTO deletion_records (
        id, organization_id, case_id, evidence_count, total_bytes, evidence_hashes,
        requested_by, key_destroyed_at, backups_expire_at
    ) VALUES (
        p_record_id, v_organization, p_case_id, v_count, v_bytes, v_hashes,
        p_requested_by, now(), now() + p_backup_retention
    );

    PERFORM set_config('aletheia.purge_case_id', p_case_id::text, true);
    DELETE FROM custody_events WHERE case_id = p_case_id;
    PERFORM set_config('aletheia.purge_case_id', '', true);

    DELETE FROM exports WHERE case_id = p_case_id;
    DELETE FROM evidences WHERE case_id = p_case_id;
    DELETE FROM case_members WHERE case_id = p_case_id;
    DELETE FROM cases WHERE id = p_case_id;

    UPDATE organizations
    SET storage_used_bytes = greatest(storage_used_bytes - v_bytes, 0)
    WHERE id = v_organization;

    RETURN p_record_id;
END;
$$
"""


def upgrade() -> None:
    # Contexto de la transacción. Si no se fijó, o se fijó vacío, devuelven NULL y ninguna
    # política deja pasar filas.
    op.execute(
        """
        CREATE FUNCTION app_organization_id() RETURNS uuid
        LANGUAGE sql STABLE
        AS $$ SELECT NULLIF(current_setting('aletheia.organization_id', true), '')::uuid $$
        """
    )
    op.execute(
        """
        CREATE FUNCTION app_user_id() RETURNS uuid
        LANGUAGE sql STABLE
        AS $$ SELECT NULLIF(current_setting('aletheia.user_id', true), '')::uuid $$
        """
    )
    op.execute(f"GRANT EXECUTE ON FUNCTION app_organization_id(), app_user_id() TO {_ROLES}")

    for table in _ORGANIZATION_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY organization_isolation ON {table} TO {_ROLES} "
            "USING (organization_id = app_organization_id()) "
            "WITH CHECK (organization_id = app_organization_id())"
        )

    # La organización misma: solo la propia. Al registrarse, la aplicación fija como contexto
    # el identificador que acaba de generar antes de insertarla.
    op.execute("ALTER TABLE organizations ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY organization_isolation ON organizations TO {_ROLES} "
        "USING (id = app_organization_id()) WITH CHECK (id = app_organization_id())"
    )

    # Membresías: las de la organización y, además, la propia. Al ingresar, la aplicación
    # conoce a la persona pero no su organización; la encuentra en su membresía.
    op.execute("ALTER TABLE memberships ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY organization_isolation ON memberships TO {_ROLES} "
        "USING (organization_id = app_organization_id()) "
        "WITH CHECK (organization_id = app_organization_id())"
    )
    op.execute(
        f"CREATE POLICY own_membership ON memberships FOR SELECT TO {_ROLES} "
        "USING (user_id = app_user_id())"
    )

    # Auditoría: cada organización lee solo sus eventos. Los eventos sin organización, como un
    # ingreso fallido, se pueden escribir pero ninguna organización los lee.
    op.execute("ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY organization_read ON audit_log FOR SELECT TO {_ROLES} "
        "USING (organization_id = app_organization_id())"
    )
    op.execute(
        f"CREATE POLICY organization_write ON audit_log FOR INSERT TO {_ROLES} "
        "WITH CHECK (organization_id IS NULL OR organization_id = app_organization_id())"
    )

    # purge_case corre como dueño y no pasa por las políticas: comprueba la organización ella
    # misma, para que un caso solo se elimine desde su propia organización.
    op.execute(_PURGE_CASE.format(same_organization=" AND organization_id = app_organization_id()"))


def downgrade() -> None:
    op.execute(_PURGE_CASE.format(same_organization=""))
    op.execute("DROP POLICY organization_write ON audit_log")
    op.execute("DROP POLICY organization_read ON audit_log")
    op.execute("ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY")
    op.execute("DROP POLICY own_membership ON memberships")
    for table in ("memberships", "organizations", *_ORGANIZATION_TABLES):
        op.execute(f"DROP POLICY organization_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute("DROP FUNCTION app_user_id()")
    op.execute("DROP FUNCTION app_organization_id()")
