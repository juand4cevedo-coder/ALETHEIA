"""archivo y retención de casos

Revisión: 0024
Anterior: 0023

Cerrar un caso lo mueve al archivo sin borrar el expediente, sus evidencias, llaves ni cadena.
La fecha mínima de revisión de la conservación queda explícita y puede extenderse mediante un
bloqueo jurídico. La base impide purgar antes de esa fecha o mientras exista el bloqueo.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: str | Sequence[str] | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_AUDIT_BEFORE = (
    "user_registered",
    "email_verified",
    "login",
    "login_failed",
    "google_linked",
    "session_reuse_detected",
    "sessions_revoked",
    "password_reset",
    "password_changed",
    "invitation_sent",
    "invitation_revoked",
    "invitation_accepted",
    "role_changed",
    "member_removed",
    "plan_changed",
    "subscription_canceled",
    "subscription_expired",
    "courtesy_granted",
    "courtesy_renewed",
    "courtesy_revoked",
    "account_blocked",
    "account_unblocked",
    "legal_accepted",
    "logout",
    "case_created",
    "platform_admin_granted",
    "support_ticket_opened",
    "support_ticket_closed",
    "support_ticket_reopened",
    "payment_approved",
    "payment_declined",
    "organization_renamed",
)
_AUDIT_AFTER = (*_AUDIT_BEFORE, "case_closed", "case_reopened")
_CUSTODY_BEFORE = (
    "case_created",
    "member_added",
    "member_removed",
    "evidence_uploaded",
    "evidence_stamped",
    "evidence_stamp_failed",
    "evidence_downloaded",
    "export_requested",
    "export_ready",
    "export_downloaded",
    "chain_verified",
    "case_closed",
    "deletion_requested",
)
_CUSTODY_AFTER = (*_CUSTODY_BEFORE, "case_reopened")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.add_column("cases", sa.Column("retention_until", sa.DateTime(timezone=True)))
    op.add_column("cases", sa.Column("retention_basis", sa.Text()))
    op.add_column(
        "cases", sa.Column("legal_hold", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.execute(
        "UPDATE cases SET retention_until = closed_at + interval '10 years', "
        "retention_basis = 'organization_policy' WHERE status = 'closed'"
    )
    op.create_check_constraint(
        op.f("ck_cases_retention_basis"),
        "cases",
        "retention_basis IS NULL OR retention_basis IN "
        "('organization_policy', 'legal_or_contractual_duty', 'litigation_hold')",
    )
    op.create_check_constraint(
        op.f("ck_cases_closed_retention"),
        "cases",
        "status <> 'closed' OR (retention_until IS NOT NULL AND retention_basis IS NOT NULL)",
    )
    op.create_index(
        op.f("ix_cases_organization_id_status_retention_until"),
        "cases",
        ["organization_id", "status", "retention_until"],
    )

    # La aplicación no recibe UPDATE general sobre casos. Esta función permite solamente las
    # dos transiciones de archivo, valida el contexto RLS y conserva el plazo en la base.
    op.execute(
        """
        CREATE FUNCTION transition_case_lifecycle(
            p_case_id uuid,
            p_organization_id uuid,
            p_actor_user_id uuid,
            p_target_status text,
            p_occurred_at timestamptz
        ) RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public, pg_temp
        AS $$
        DECLARE
            changed integer;
        BEGIN
            IF p_organization_id IS DISTINCT FROM app_organization_id()
               OR p_actor_user_id IS DISTINCT FROM app_user_id() THEN
                RAISE EXCEPTION 'contexto de organización inválido' USING ERRCODE = '42501';
            END IF;
            IF NOT EXISTS (
                SELECT 1
                FROM memberships m
                JOIN users u ON u.id = m.user_id
                JOIN organizations o ON o.id = m.organization_id
                WHERE m.organization_id = p_organization_id
                  AND m.user_id = p_actor_user_id
                  AND m.role IN ('owner', 'admin', 'lawyer')
                  AND u.status = 'active'
                  AND o.status = 'active'
            ) THEN
                RAISE EXCEPTION 'transición no autorizada' USING ERRCODE = '42501';
            END IF;

            IF p_target_status = 'closed' THEN
                UPDATE cases
                SET status = 'closed',
                    closed_at = p_occurred_at,
                    retention_until = p_occurred_at + interval '10 years',
                    retention_basis = 'organization_policy',
                    legal_hold = false
                WHERE id = p_case_id
                  AND organization_id = p_organization_id
                  AND status = 'open';
            ELSIF p_target_status = 'open' THEN
                UPDATE cases
                SET status = 'open',
                    closed_at = NULL,
                    retention_until = NULL,
                    retention_basis = NULL,
                    legal_hold = false
                WHERE id = p_case_id
                  AND organization_id = p_organization_id
                  AND status = 'closed';
            ELSE
                RAISE EXCEPTION 'estado de destino inválido' USING ERRCODE = '22023';
            END IF;

            GET DIAGNOSTICS changed = ROW_COUNT;
            IF changed <> 1 THEN
                RAISE EXCEPTION 'el caso no admite esa transición' USING ERRCODE = '55000';
            END IF;
        END;
        $$
        """
    )
    op.execute(
        "REVOKE ALL ON FUNCTION transition_case_lifecycle(uuid, uuid, uuid, text, timestamptz) "
        "FROM PUBLIC, aletheia_support"
    )
    op.execute(
        "GRANT EXECUTE ON FUNCTION "
        "transition_case_lifecycle(uuid, uuid, uuid, text, timestamptz) TO aletheia_app"
    )

    # purge_case sigue siendo la única vía de supresión y conserva su autorización propia. Este
    # trigger añade la barrera que no puede depender del futuro trabajador: ni esa función ni el
    # dueño del esquema pueden borrar el expediente antes de la revisión o con bloqueo jurídico.
    op.execute(
        """
        CREATE FUNCTION enforce_case_retention_before_delete() RETURNS trigger
        LANGUAGE plpgsql
        SET search_path = public, pg_temp
        AS $$
        BEGIN
            IF OLD.retention_until IS NULL OR OLD.retention_until > now() THEN
                RAISE EXCEPTION 'el plazo de conservación del caso no ha terminado'
                    USING ERRCODE = '55000';
            END IF;
            IF OLD.legal_hold THEN
                RAISE EXCEPTION 'el caso tiene un bloqueo jurídico vigente'
                    USING ERRCODE = '55000';
            END IF;
            RETURN OLD;
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER cases_retention_before_delete
        BEFORE DELETE ON cases
        FOR EACH ROW EXECUTE FUNCTION enforce_case_retention_before_delete()
        """
    )

    op.drop_constraint(op.f("ck_custody_events_action"), "custody_events", type_="check")
    op.create_check_constraint(
        op.f("ck_custody_events_action"),
        "custody_events",
        _in("action", _CUSTODY_AFTER),
    )
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _in("action", _AUDIT_AFTER)
    )
    op.execute("GRANT EXECUTE ON FUNCTION purge_case(uuid, uuid, uuid, interval) TO aletheia_app")


def downgrade() -> None:
    # Durante el desarrollo, una base puede haber quedado marcada en 0024 antes de que esta
    # función entrara en la migración. IF EXISTS permite reconstruir esa base de pruebas sin
    # debilitar la reversión normal de una instalación que sí ejecutó el upgrade completo.
    op.execute(
        "DROP FUNCTION IF EXISTS transition_case_lifecycle(uuid, uuid, uuid, text, timestamptz)"
    )
    op.execute("DROP TRIGGER IF EXISTS cases_retention_before_delete ON cases")
    op.execute("DROP FUNCTION IF EXISTS enforce_case_retention_before_delete()")
    op.execute("DELETE FROM audit_log WHERE action IN ('case_closed', 'case_reopened')")
    op.drop_constraint(op.f("ck_audit_log_action"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action"), "audit_log", _in("action", _AUDIT_BEFORE)
    )
    op.execute("ALTER TABLE custody_events DISABLE TRIGGER custody_events_append_only")
    op.execute("DELETE FROM custody_events WHERE action = 'case_reopened'")
    op.execute("ALTER TABLE custody_events ENABLE TRIGGER custody_events_append_only")
    op.drop_constraint(op.f("ck_custody_events_action"), "custody_events", type_="check")
    op.create_check_constraint(
        op.f("ck_custody_events_action"),
        "custody_events",
        _in("action", _CUSTODY_BEFORE),
    )
    op.drop_index(op.f("ix_cases_organization_id_status_retention_until"), table_name="cases")
    op.drop_constraint(op.f("ck_cases_closed_retention"), "cases", type_="check")
    op.drop_constraint(op.f("ck_cases_retention_basis"), "cases", type_="check")
    op.drop_column("cases", "legal_hold")
    op.drop_column("cases", "retention_basis")
    op.drop_column("cases", "retention_until")
