"""enlaces para compartir una evidencia

Un enlace da acceso a un solo archivo, sin cuenta y hasta una fecha. Cada creación, revocación y
descarga queda en la cadena de custodia del caso (la descarga con actor nulo, porque quien
descarga no tiene cuenta); la descarga además deja una fila en la auditoría del despacho con la
IP y el navegador, que no entran en la cadena porque esa cadena viaja en los paquetes.

El enlace en sí no se guarda: va firmado y solo su identificador vive aquí, así que revocarlo es
marcar la fila. Si se borra la evidencia o el caso, la fila se va con ellos.

Revision ID: 0039
Revises: 0038
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0039"
down_revision: str | Sequence[str] | None = "0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

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
    "case_reopened",
    "case_retention_updated",
    "deletion_requested",
)
_CUSTODY_NEW = (
    "evidence_link_created",
    "evidence_link_revoked",
    "evidence_link_downloaded",
)

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
    "case_closed",
    "case_reopened",
    "case_retention_updated",
    "case_task_created",
    "case_task_status_changed",
    "account_closed",
    "case_note_created",
    "organization_policy_changed",
    "two_factor_enabled",
    "two_factor_disabled",
    "two_factor_failed",
    "two_factor_recovery_used",
    "two_factor_codes_regenerated",
)
_AUDIT_NEW = ("evidence_link_downloaded",)


def _allowed(values: tuple[str, ...]) -> str:
    return "action IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def _replace(table: str, values: tuple[str, ...]) -> None:
    name = op.f(f"ck_{table}_action")
    op.drop_constraint(name, table, type_="check")
    op.create_check_constraint(name, table, _allowed(values))


def upgrade() -> None:
    op.create_table(
        "evidence_share_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("evidence_id", sa.Uuid(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by", sa.Uuid(), nullable=True),
        sa.Column("download_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_downloaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_evidence_share_links")),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
            name=op.f("fk_evidence_share_links_organization_id_case_id_cases"),
        ),
        sa.ForeignKeyConstraint(
            ["case_id", "evidence_id"],
            ["evidences.case_id", "evidences.id"],
            ondelete="CASCADE",
            name=op.f("fk_evidence_share_links_case_id_evidence_id_evidences"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_evidence_share_links_created_by_users"),
        ),
        sa.ForeignKeyConstraint(
            ["revoked_by"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_evidence_share_links_revoked_by_users"),
        ),
        sa.CheckConstraint(
            "label IS NULL OR char_length(label) BETWEEN 1 AND 120",
            name=op.f("ck_evidence_share_links_label"),
        ),
        sa.CheckConstraint(
            "download_count >= 0", name=op.f("ck_evidence_share_links_download_count")
        ),
    )
    op.create_index(
        "ix_evidence_share_links_evidence_id_created_at",
        "evidence_share_links",
        ["evidence_id", "created_at"],
    )
    op.execute("ALTER TABLE evidence_share_links ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY evidence_share_links_isolation ON evidence_share_links TO aletheia_app "
        "USING (organization_id = app_organization_id()) "
        "WITH CHECK (organization_id = app_organization_id())"
    )
    op.execute("REVOKE ALL ON evidence_share_links FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT, UPDATE ON evidence_share_links TO aletheia_app")

    _replace("custody_events", (*_CUSTODY_BEFORE, *_CUSTODY_NEW))
    _replace("audit_log", (*_AUDIT_BEFORE, *_AUDIT_NEW))


def downgrade() -> None:
    op.execute("DELETE FROM audit_log WHERE action = 'evidence_link_downloaded'")
    _replace("audit_log", _AUDIT_BEFORE)
    # La cadena es de solo inserción: un downgrade con eventos de enlaces no puede quitar su
    # acción de la lista sin borrarlos, así que la lista nueva se conserva en ese caso.
    op.drop_table("evidence_share_links")
