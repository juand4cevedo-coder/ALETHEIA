"""cadena de custodia calculada por la base y purge_case autorizado

Revisión: 0013
Anterior: 0012
Creada: 2026-11-10

La base calcula el hash de cada evento de custodia (ADR-037). Hasta ahora el trigger
custody_events_chain comprobaba el orden y el hash anterior, pero aceptaba el event_hash que
mandara la aplicación sin comprobar que correspondiera a los datos guardados. Desde aquí lo
calcula él mismo, con SHA-256 sobre la serialización canónica de custody_event_canonical, y
reemplaza cualquier valor recibido. Así cada hash corresponde por construcción a sus datos, y un
verificador independiente puede repetir el cálculo fuera de la base (app.services.custody_chain).

purge_case comprueba además que quien pide la eliminación sea la persona de la sesión y tenga
el rol de propietario o administrador en la organización del caso (RN-020).
"""

from collections.abc import Sequence
from typing import Final

from alembic import op

revision: str = "0013"
down_revision: str | Sequence[str] | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Serialización canónica, versión 1. Un campo por línea; details va al final y en el texto
# canónico de JSONB, que escapa los saltos de línea, así que ningún campo puede simular otro.
# La fecha va en UTC con microsegundos y los nulos como un guion. Si cambia, cambia la versión.
_CANONICAL: Final = """
CREATE FUNCTION custody_event_canonical(
    p_prev_hash bytea,
    p_case_id uuid,
    p_seq integer,
    p_evidence_id uuid,
    p_actor_user_id uuid,
    p_action text,
    p_details jsonb,
    p_occurred_at timestamptz
) RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT concat_ws(
        chr(10),
        'aletheia-custody-v1',
        encode(p_prev_hash, 'hex'),
        p_case_id::text,
        p_seq::text,
        coalesce(p_evidence_id::text, '-'),
        coalesce(p_actor_user_id::text, '-'),
        p_action,
        to_char(p_occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        p_details::text
    )
$$
"""

_CHAIN_BODY: Final = """
CREATE OR REPLACE FUNCTION custody_events_chain() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    last_seq integer;
    expected_prev bytea;
BEGIN
    -- Bloquea el caso: dos eventos del mismo caso nunca se encadenan a la vez.
    SELECT custody_seq INTO last_seq FROM cases WHERE id = NEW.case_id FOR UPDATE;
    IF NOT FOUND THEN
        -- La llave foránea rechaza la fila con su propio mensaje.
        RETURN NEW;
    END IF;
    IF NEW.seq <> last_seq + 1 THEN
        RAISE EXCEPTION 'El evento % no sigue al evento % del caso %',
            NEW.seq, last_seq, NEW.case_id
            USING ERRCODE = 'check_violation';
    END IF;
    IF last_seq = 0 THEN
        expected_prev := decode(repeat('00', 32), 'hex');
    ELSE
        SELECT event_hash INTO expected_prev
        FROM custody_events
        WHERE case_id = NEW.case_id AND seq = last_seq;
    END IF;
    IF NEW.prev_hash IS DISTINCT FROM expected_prev THEN
        RAISE EXCEPTION 'El evento % no trae el hash del evento anterior', NEW.seq
            USING ERRCODE = 'check_violation';
    END IF;{digest}
    UPDATE cases SET custody_seq = NEW.seq WHERE id = NEW.case_id;
    RETURN NEW;
END;
$$
"""

_DIGEST: Final = """
    -- El hash lo calcula la base sobre los datos que quedan guardados; el que mande la
    -- aplicación se descarta.
    NEW.event_hash := sha256(convert_to(custody_event_canonical(
        NEW.prev_hash, NEW.case_id, NEW.seq, NEW.evidence_id, NEW.actor_user_id,
        NEW.action, NEW.details, NEW.occurred_at
    ), 'UTF8'));"""

# purge_case de la migración 0005, con la autorización de quien la pide.
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
    DELETE FROM case_members WHERE case_id = p_case_id;
    DELETE FROM cases WHERE id = p_case_id;

    UPDATE organizations
    SET storage_used_bytes = greatest(storage_used_bytes - v_bytes, 0)
    WHERE id = v_organization;

    RETURN p_record_id;
END;
$$
"""

# purge_case tal como la dejó la migración 0005, para volver atrás.
_PURGE_CASE_0005: Final = """
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
    op.execute(_CANONICAL)
    op.execute(
        "GRANT EXECUTE ON FUNCTION custody_event_canonical("
        "bytea, uuid, integer, uuid, uuid, text, jsonb, timestamptz) TO aletheia_app"
    )
    op.execute(_CHAIN_BODY.format(digest=_DIGEST))
    op.execute(_PURGE_CASE)


def downgrade() -> None:
    op.execute(_PURGE_CASE_0005)
    op.execute(_CHAIN_BODY.format(digest="").replace("IS DISTINCT FROM", "<>"))
    op.execute(
        "DROP FUNCTION custody_event_canonical("
        "bytea, uuid, integer, uuid, uuid, text, jsonb, timestamptz)"
    )
