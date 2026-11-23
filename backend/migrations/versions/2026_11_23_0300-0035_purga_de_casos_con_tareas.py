"""purga de casos con tareas

purge_case borraba los miembros del caso antes de sus tareas, y la clave que une cada tarea con
su responsable lo impide: un caso con tareas no se podía eliminar aunque el plazo de conservación
hubiera vencido. La función ahora borra primero las tareas. Las notas ya se van con el caso por
la cascada de su clave foránea.

Revision ID: 0035
Revises: 0034
"""

from collections.abc import Sequence
from typing import Final

from alembic import op

revision: str = "0035"
down_revision: str | Sequence[str] | None = "0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

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
    FROM cases WHERE id = p_case_id AND organization_id = app_organization_id() FOR UPDATE;
    IF NOT FOUND THEN
        SELECT id INTO v_existing
        FROM deletion_records WHERE case_id = p_case_id AND organization_id = app_organization_id();
        IF FOUND THEN
            RETURN v_existing;
        END IF;
        RAISE EXCEPTION 'El caso % no existe', p_case_id USING ERRCODE = 'no_data_found';
    END IF;
    -- Quien la pide es quien tiene la sesión, y es propietario o administrador de la
    -- organización del caso (RN-020). La función corre como dueño y no pasa por las
    -- políticas: la autorización la comprueba ella misma.
    IF p_requested_by IS DISTINCT FROM app_user_id() OR NOT EXISTS (
        SELECT 1 FROM memberships
        WHERE organization_id = v_organization
          AND user_id = p_requested_by
          AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Solo el propietario o un administrador del caso pueden eliminarlo'
            USING ERRCODE = 'insufficient_privilege';
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
    DELETE FROM case_tasks WHERE case_id = p_case_id;
    DELETE FROM case_members WHERE case_id = p_case_id;
    DELETE FROM cases WHERE id = p_case_id;

    UPDATE organizations
    SET storage_used_bytes = greatest(storage_used_bytes - v_bytes, 0)
    WHERE id = v_organization;

    RETURN p_record_id;
END;
$$
"""

_PURGE_CASE_0013: Final = """
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
    FROM cases WHERE id = p_case_id AND organization_id = app_organization_id() FOR UPDATE;
    IF NOT FOUND THEN
        SELECT id INTO v_existing
        FROM deletion_records WHERE case_id = p_case_id AND organization_id = app_organization_id();
        IF FOUND THEN
            RETURN v_existing;
        END IF;
        RAISE EXCEPTION 'El caso % no existe', p_case_id USING ERRCODE = 'no_data_found';
    END IF;
    -- Quien la pide es quien tiene la sesión, y es propietario o administrador de la
    -- organización del caso (RN-020). La función corre como dueño y no pasa por las
    -- políticas: la autorización la comprueba ella misma.
    IF p_requested_by IS DISTINCT FROM app_user_id() OR NOT EXISTS (
        SELECT 1 FROM memberships
        WHERE organization_id = v_organization
          AND user_id = p_requested_by
          AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Solo el propietario o un administrador del caso pueden eliminarlo'
            USING ERRCODE = 'insufficient_privilege';
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
    op.execute(_PURGE_CASE)


def downgrade() -> None:
    op.execute(_PURGE_CASE_0013)
