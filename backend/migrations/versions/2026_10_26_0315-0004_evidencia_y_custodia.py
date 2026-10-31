"""evidencia y custodia

Revisión: 0004
Anterior: 0003
Creada: 2026-10-26

Crea las tablas de casos, miembros, evidencias, cadena de custodia, paquetes y constancias de
eliminación, junto con las reglas que la base hace cumplir por sí misma (ADR-004):

- La cadena de custodia es de solo inserción. Cada evento debe seguir al anterior sin huecos
  y traer el hash del evento previo; un trigger lo comprueba bajo el bloqueo del caso.
- Ningún evento se edita ni se borra, salvo dentro de purge_case, que primero escribe la
  constancia de eliminación (RN-006, RN-020).
- La aplicación no borra casos, evidencias ni paquetes: eso solo ocurre en purge_case.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("internal_reference", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), server_default="open", nullable=False),
        sa.Column("wrapped_key", sa.LargeBinary(), nullable=True),
        sa.Column("key_version", sa.Text(), nullable=False),
        sa.Column("custody_seq", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(status = 'open') = (closed_at IS NULL)", name=op.f("ck_cases_closed_at")
        ),
        sa.CheckConstraint(
            "status IN ('open', 'closed', 'deleting')", name=op.f("ck_cases_status")
        ),
        sa.CheckConstraint(
            "wrapped_key IS NOT NULL OR status = 'deleting'", name=op.f("ck_cases_wrapped_key")
        ),
        sa.CheckConstraint(
            "char_length(internal_reference) BETWEEN 1 AND 80",
            name=op.f("ck_cases_internal_reference_length"),
        ),
        sa.CheckConstraint(
            "char_length(key_version) BETWEEN 1 AND 120", name=op.f("ck_cases_key_version_length")
        ),
        sa.CheckConstraint(
            "char_length(title) BETWEEN 1 AND 160", name=op.f("ck_cases_title_length")
        ),
        sa.CheckConstraint("custody_seq >= 0", name=op.f("ck_cases_custody_seq")),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_cases_created_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_cases_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cases")),
        sa.UniqueConstraint("organization_id", "id", name=op.f("uq_cases_organization_id_id")),
    )
    op.create_table(
        "deletion_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("evidence_count", sa.Integer(), nullable=False),
        sa.Column("total_bytes", sa.BigInteger(), nullable=False),
        sa.Column("evidence_hashes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("requested_by", sa.Uuid(), nullable=False),
        sa.Column("key_destroyed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("backups_expire_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "backups_expire_at >= key_destroyed_at",
            name=op.f("ck_deletion_records_backups_expire_at"),
        ),
        sa.CheckConstraint("evidence_count >= 0", name=op.f("ck_deletion_records_evidence_count")),
        sa.CheckConstraint("total_bytes >= 0", name=op.f("ck_deletion_records_total_bytes")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_deletion_records_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"], ["users.id"], name=op.f("fk_deletion_records_requested_by_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deletion_records")),
        sa.UniqueConstraint("case_id", name=op.f("uq_deletion_records_case_id")),
    )
    op.create_table(
        "case_members",
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("added_by", sa.Uuid(), nullable=False),
        sa.Column(
            "added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["added_by"], ["users.id"], name=op.f("fk_case_members_added_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            name=op.f("fk_case_members_organization_id_case_id_cases"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_case_members_user_id_users")
        ),
        sa.PrimaryKeyConstraint("case_id", "user_id", name=op.f("pk_case_members")),
    )
    op.create_index(op.f("ix_case_members_user_id"), "case_members", ["user_id"], unique=False)
    op.create_table(
        "evidences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("sha256", sa.LargeBinary(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("original_filename", sa.Text(), nullable=False),
        sa.Column("declared_type", sa.Text(), nullable=False),
        sa.Column("detected_type", sa.Text(), nullable=False),
        sa.Column("declared_origin", sa.Text(), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("tsa_status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("tsa_token", sa.LargeBinary(), nullable=True),
        sa.Column("tsa_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("uploaded_by", sa.Uuid(), nullable=False),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "declared_type IN ('chat', 'email', 'audio', 'image', 'document', 'other')",
            name=op.f("ck_evidences_declared_type"),
        ),
        sa.CheckConstraint(
            "tsa_status <> 'stamped' OR (tsa_token IS NOT NULL AND tsa_time IS NOT NULL)",
            name=op.f("ck_evidences_tsa_stamped"),
        ),
        sa.CheckConstraint(
            "tsa_status IN ('pending', 'stamped', 'failed')", name=op.f("ck_evidences_tsa_status")
        ),
        sa.CheckConstraint(
            "char_length(declared_origin) BETWEEN 1 AND 500",
            name=op.f("ck_evidences_declared_origin_length"),
        ),
        sa.CheckConstraint(
            "char_length(detected_type) BETWEEN 1 AND 120",
            name=op.f("ck_evidences_detected_type_length"),
        ),
        sa.CheckConstraint(
            "char_length(original_filename) BETWEEN 1 AND 255",
            name=op.f("ck_evidences_original_filename_length"),
        ),
        sa.CheckConstraint(
            "char_length(storage_key) BETWEEN 1 AND 200",
            name=op.f("ck_evidences_storage_key_length"),
        ),
        sa.CheckConstraint("octet_length(sha256) = 32", name=op.f("ck_evidences_sha256_length")),
        sa.CheckConstraint("size_bytes > 0", name=op.f("ck_evidences_size_bytes")),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            name=op.f("fk_evidences_organization_id_case_id_cases"),
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"], ["users.id"], name=op.f("fk_evidences_uploaded_by_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_evidences")),
        sa.UniqueConstraint("case_id", "id", name=op.f("uq_evidences_case_id_id")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_evidences_storage_key")),
    )
    op.create_table(
        "exports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by", sa.Uuid(), nullable=False),
        sa.Column("status", sa.Text(), server_default="queued", nullable=False),
        sa.Column("manifest_sha256", sa.LargeBinary(), nullable=True),
        sa.Column("storage_key", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status <> 'ready' OR (manifest_sha256 IS NOT NULL AND storage_key IS NOT NULL "
            "AND expires_at IS NOT NULL)",
            name=op.f("ck_exports_ready"),
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'building', 'ready', 'failed', 'expired')",
            name=op.f("ck_exports_status"),
        ),
        sa.CheckConstraint(
            "char_length(storage_key) BETWEEN 1 AND 200", name=op.f("ck_exports_storage_key_length")
        ),
        sa.CheckConstraint(
            "manifest_sha256 IS NULL OR octet_length(manifest_sha256) = 32",
            name=op.f("ck_exports_manifest_sha256_length"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            name=op.f("fk_exports_organization_id_case_id_cases"),
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"], ["users.id"], name=op.f("fk_exports_requested_by_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exports")),
    )
    op.create_index("ix_exports_case_id_id", "exports", ["case_id", "id"], unique=False)
    op.create_table(
        "custody_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("evidence_id", sa.Uuid(), nullable=True),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("prev_hash", sa.LargeBinary(), nullable=False),
        sa.Column("event_hash", sa.LargeBinary(), nullable=False),
        sa.CheckConstraint(
            "action IN ('case_created', 'member_added', 'member_removed', 'evidence_uploaded', "
            "'evidence_stamped', 'evidence_stamp_failed', 'evidence_downloaded', "
            "'export_requested', 'export_ready', 'export_downloaded', 'chain_verified', "
            "'case_closed', 'deletion_requested')",
            name=op.f("ck_custody_events_action"),
        ),
        sa.CheckConstraint(
            "octet_length(event_hash) = 32", name=op.f("ck_custody_events_event_hash_length")
        ),
        sa.CheckConstraint(
            "octet_length(prev_hash) = 32", name=op.f("ck_custody_events_prev_hash_length")
        ),
        sa.CheckConstraint("seq >= 1", name=op.f("ck_custody_events_seq")),
        sa.ForeignKeyConstraint(
            ["actor_user_id"], ["users.id"], name=op.f("fk_custody_events_actor_user_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["case_id", "evidence_id"],
            ["evidences.case_id", "evidences.id"],
            name=op.f("fk_custody_events_case_id_evidence_id_evidences"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            name=op.f("fk_custody_events_organization_id_case_id_cases"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_custody_events")),
        sa.UniqueConstraint("case_id", "seq", name=op.f("uq_custody_events_case_id_seq")),
    )

    # Cadena de custodia: cada evento nuevo sigue al último del caso y trae su hash. Corre con
    # los permisos del dueño para que la aplicación no pueda mover el contador por su cuenta.
    op.execute(
        """
        CREATE FUNCTION custody_events_chain() RETURNS trigger
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
            IF NEW.prev_hash <> expected_prev THEN
                RAISE EXCEPTION 'El evento % no trae el hash del evento anterior', NEW.seq
                    USING ERRCODE = 'check_violation';
            END IF;
            UPDATE cases SET custody_seq = NEW.seq WHERE id = NEW.case_id;
            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER custody_events_chain BEFORE INSERT ON custody_events "
        "FOR EACH ROW EXECUTE FUNCTION custody_events_chain()"
    )

    # Solo inserción: UPDATE, DELETE y TRUNCATE se rechazan siempre, excepto el borrado de los
    # eventos del caso que purge_case está eliminando en esa misma transacción.
    op.execute(
        """
        CREATE FUNCTION custody_events_append_only() RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            IF TG_OP = 'DELETE'
                AND OLD.case_id::text = current_setting('aletheia.purge_case_id', true) THEN
                RETURN OLD;
            END IF;
            RAISE EXCEPTION 'La cadena de custodia no se modifica ni se borra (RN-006)'
                USING ERRCODE = 'restrict_violation';
        END;
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER custody_events_append_only BEFORE UPDATE OR DELETE ON custody_events "
        "FOR EACH ROW EXECUTE FUNCTION custody_events_append_only()"
    )
    op.execute(
        "CREATE TRIGGER custody_events_no_truncate BEFORE TRUNCATE ON custody_events "
        "FOR EACH STATEMENT EXECUTE FUNCTION custody_events_append_only()"
    )

    # La constancia de eliminación es permanente y nadie la cambia.
    op.execute(
        """
        CREATE FUNCTION deletion_records_immutable() RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            RAISE EXCEPTION 'La constancia de eliminación no se modifica ni se borra'
                USING ERRCODE = 'restrict_violation';
        END;
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER deletion_records_immutable BEFORE UPDATE OR DELETE ON deletion_records "
        "FOR EACH ROW EXECUTE FUNCTION deletion_records_immutable()"
    )
    op.execute(
        "CREATE TRIGGER deletion_records_no_truncate BEFORE TRUNCATE ON deletion_records "
        "FOR EACH STATEMENT EXECUTE FUNCTION deletion_records_immutable()"
    )

    # Eliminación de un caso (SEQ-004): la única vía para borrar sus datos. Primero escribe la
    # constancia y después borra, todo en una transacción. Si se repite, devuelve la misma
    # constancia (EVT-004). La llave envuelta desaparece con la fila del caso; los respaldos la
    # conservan hasta backups_expire_at.
    op.execute(
        """
        CREATE FUNCTION purge_case(
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
            FROM cases WHERE id = p_case_id FOR UPDATE;
            IF NOT FOUND THEN
                SELECT id INTO v_existing FROM deletion_records WHERE case_id = p_case_id;
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
    )
    op.execute("GRANT EXECUTE ON FUNCTION purge_case(uuid, uuid, uuid, interval) TO aletheia_app")

    # Permisos de la aplicación: lo que no se borra ni se cambia aquí solo lo hace purge_case.
    op.execute("REVOKE UPDATE, DELETE ON custody_events FROM aletheia_app")
    op.execute("REVOKE INSERT, UPDATE, DELETE ON deletion_records FROM aletheia_app")
    op.execute("REVOKE DELETE ON cases, evidences, exports FROM aletheia_app")
    op.execute("REVOKE UPDATE ON cases, evidences, case_members FROM aletheia_app")
    op.execute("GRANT UPDATE (status, closed_at, wrapped_key) ON cases TO aletheia_app")
    # El original es inmutable (RN-002): de una evidencia solo cambia su sello de tiempo.
    op.execute("GRANT UPDATE (tsa_status, tsa_token, tsa_time) ON evidences TO aletheia_app")

    # Soporte nunca ve el contenido de los casos (RN-009); sí las constancias, que no lo tienen.
    op.execute(
        "REVOKE SELECT ON cases, case_members, evidences, custody_events, exports "
        "FROM aletheia_support"
    )


def downgrade() -> None:
    # Al borrar cada tabla desaparecen sus triggers, filas y permisos; las funciones no.
    op.drop_table("custody_events")
    op.drop_index("ix_exports_case_id_id", table_name="exports")
    op.drop_table("exports")
    op.drop_table("evidences")
    op.drop_index(op.f("ix_case_members_user_id"), table_name="case_members")
    op.drop_table("case_members")
    op.drop_table("deletion_records")
    op.drop_table("cases")
    op.execute("DROP FUNCTION purge_case(uuid, uuid, uuid, interval)")
    op.execute("DROP FUNCTION deletion_records_immutable()")
    op.execute("DROP FUNCTION custody_events_append_only()")
    op.execute("DROP FUNCTION custody_events_chain()")
