"""anclaje periódico de custodia

Revisión: 0033
Anterior: 0032

Guarda sellos inmutables de cabezas de custodia y programa uno 24 horas después de cada evento.
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0033"
down_revision: str | Sequence[str] | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_KINDS_BEFORE = (
    "tsa_stamp",
    "export_build",
    "email_send",
    "case_purge",
    "payment_reconcile",
    "export_expire",
    "audit_anonymize",
    "subscription_expire",
)


def _values(values: tuple[str, ...]) -> str:
    return "kind IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.create_table(
        "custody_anchors",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("head_hash", sa.LargeBinary(), nullable=False),
        sa.Column("tsa_token", sa.LargeBinary(), nullable=False),
        sa.Column("tsa_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("seq >= 1", name=op.f("ck_custody_anchors_seq")),
        sa.CheckConstraint(
            "octet_length(head_hash) = 32",
            name=op.f("ck_custody_anchors_head_hash_length"),
        ),
        sa.CheckConstraint(
            "octet_length(tsa_token) > 0",
            name=op.f("ck_custody_anchors_tsa_token_not_empty"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            name=op.f("fk_custody_anchors_organization_id_case_id_cases"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_custody_anchors")),
        sa.UniqueConstraint("case_id", "seq", name=op.f("uq_custody_anchors_case_id_seq")),
    )
    op.execute("ALTER TABLE custody_anchors ENABLE ROW LEVEL SECURITY")
    member = (
        "EXISTS (SELECT 1 FROM case_members cm WHERE cm.case_id = custody_anchors.case_id "
        "AND cm.user_id = app_user_id())"
    )
    op.execute(
        f"CREATE POLICY custody_anchor_read ON custody_anchors FOR SELECT "
        f"TO aletheia_app USING ({member})"
    )
    op.execute(
        "CREATE POLICY custody_anchor_worker_read ON custody_anchors FOR SELECT "
        "TO aletheia_app USING (organization_id = app_organization_id() "
        "AND app_user_id() IS NULL)"
    )
    op.execute(
        "CREATE POLICY custody_anchor_insert ON custody_anchors FOR INSERT TO aletheia_app "
        "WITH CHECK (organization_id = app_organization_id())"
    )
    op.execute("REVOKE ALL ON custody_anchors FROM aletheia_app")
    op.execute("GRANT SELECT, INSERT ON custody_anchors TO aletheia_app")
    op.execute(
        """
        CREATE FUNCTION custody_anchors_immutable() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'los anclajes de custodia son inmutables';
        END
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER custody_anchors_immutable BEFORE UPDATE OR DELETE ON custody_anchors "
        "FOR EACH ROW EXECUTE FUNCTION custody_anchors_immutable()"
    )
    op.execute(
        "CREATE TRIGGER custody_anchors_no_truncate BEFORE TRUNCATE ON custody_anchors "
        "FOR EACH STATEMENT EXECUTE FUNCTION custody_anchors_immutable()"
    )
    op.drop_constraint(op.f("ck_jobs_kind"), "jobs", type_="check")
    op.create_check_constraint(
        op.f("ck_jobs_kind"), "jobs", _values((*_KINDS_BEFORE, "custody_anchor"))
    )

    connection = op.get_bind()
    cases = connection.execute(
        sa.text("SELECT id, organization_id, custody_seq FROM cases WHERE custody_seq > 0")
    ).mappings()
    for case in cases:
        connection.execute(
            sa.text(
                "INSERT INTO jobs (id, kind, payload, idempotency_key, run_after) "
                "VALUES (:id, 'custody_anchor', "
                "jsonb_build_object('case_id', CAST(:case_id AS text), "
                "'organization_id', CAST(:organization_id AS text)), :key, now()) "
                "ON CONFLICT (idempotency_key) DO NOTHING"
            ),
            {
                "id": uuid.uuid7(),
                "case_id": str(case["id"]),
                "organization_id": str(case["organization_id"]),
                "key": f"custody_anchor:{case['id']}:{case['custody_seq']}",
            },
        )


def downgrade() -> None:
    op.execute("DELETE FROM jobs WHERE kind = 'custody_anchor'")
    op.drop_constraint(op.f("ck_jobs_kind"), "jobs", type_="check")
    op.create_check_constraint(op.f("ck_jobs_kind"), "jobs", _values(_KINDS_BEFORE))
    op.execute("DROP TRIGGER IF EXISTS custody_anchors_no_truncate ON custody_anchors")
    op.execute("DROP TRIGGER IF EXISTS custody_anchors_immutable ON custody_anchors")
    op.execute("DROP FUNCTION IF EXISTS custody_anchors_immutable()")
    op.drop_table("custody_anchors")
