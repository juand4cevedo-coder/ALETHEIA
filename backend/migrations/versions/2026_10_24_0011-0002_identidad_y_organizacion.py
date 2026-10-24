"""identidad y organización

Revisión: 0002
Anterior: 0001
Creada: 2026-10-24

Crea las tablas de identidad (users, oauth_identities, refresh_tokens, audit_log) y de
organización (organizations, memberships, invitations) según el diccionario de datos. El
aislamiento por organización con Row-Level Security llega en una migración posterior.
"""

import datetime
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _created_at() -> sa.Column[datetime.datetime]:
    # Momento de creación en UTC, puesto por PostgreSQL.
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("storage_used_bytes", sa.BigInteger(), server_default="0", nullable=False),
        _created_at(),
        sa.CheckConstraint(
            "status IN ('active', 'read_only', 'suspended')", name=op.f("ck_organizations_status")
        ),
        sa.CheckConstraint(
            "char_length(name) BETWEEN 1 AND 120", name=op.f("ck_organizations_name_length")
        ),
        sa.CheckConstraint(
            "storage_used_bytes >= 0", name=op.f("ck_organizations_storage_used_bytes")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organizations")),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("full_name", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("is_platform_admin", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("terms_version", sa.Text(), nullable=False),
        sa.Column("privacy_version", sa.Text(), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        _created_at(),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "char_length(email) <= 254 AND position('@' IN email) > 1",
            name=op.f("ck_users_email_format"),
        ),
        sa.CheckConstraint(
            "password_hash LIKE '$argon2id$%%'", name=op.f("ck_users_password_hash_argon2id")
        ),
        sa.CheckConstraint("status IN ('active', 'blocked')", name=op.f("ck_users_status")),
        sa.CheckConstraint(
            "char_length(full_name) BETWEEN 1 AND 120", name=op.f("ck_users_full_name_length")
        ),
        sa.CheckConstraint(
            "char_length(privacy_version) BETWEEN 1 AND 20", name=op.f("ck_users_privacy_version")
        ),
        sa.CheckConstraint(
            "char_length(terms_version) BETWEEN 1 AND 20", name=op.f("ck_users_terms_version")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(
        "uq_users_email_lower", "users", [sa.literal_column("lower(email)")], unique=True
    )
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=True),
        sa.Column("ip", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        _created_at(),
        sa.CheckConstraint(
            "action IN ('user_registered', 'email_verified', 'login', 'login_failed', "
            "'google_linked', 'session_reuse_detected', 'sessions_revoked', 'password_reset', "
            "'password_changed', 'invitation_sent', 'invitation_revoked', "
            "'invitation_accepted', 'role_changed', 'member_removed', 'plan_changed', "
            "'subscription_canceled', 'account_blocked', 'account_unblocked')",
            name=op.f("ck_audit_log_action"),
        ),
        sa.CheckConstraint(
            "char_length(user_agent) <= 300", name=op.f("ck_audit_log_user_agent_length")
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name=op.f("fk_audit_log_actor_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_audit_log_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_log")),
    )
    op.create_index(
        "ix_audit_log_organization_id_created_at",
        "audit_log",
        ["organization_id", "created_at"],
        unique=False,
    )
    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("invited_by", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "char_length(email) <= 254 AND position('@' IN email) > 1",
            name=op.f("ck_invitations_email_format"),
        ),
        sa.CheckConstraint(
            "role IN ('admin', 'lawyer', 'assistant')", name=op.f("ck_invitations_role")
        ),
        sa.CheckConstraint(
            "octet_length(token_hash) = 32", name=op.f("ck_invitations_token_hash_sha256")
        ),
        sa.ForeignKeyConstraint(
            ["invited_by"], ["users.id"], name=op.f("fk_invitations_invited_by_users")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_invitations_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invitations")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_invitations_token_hash")),
    )
    op.create_table(
        "memberships",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        _created_at(),
        sa.CheckConstraint(
            "role IN ('owner', 'admin', 'lawyer', 'assistant')", name=op.f("ck_memberships_role")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_memberships_organization_id_organizations"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_memberships_user_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_memberships")),
        sa.UniqueConstraint("user_id", name=op.f("uq_memberships_user_id")),
    )
    op.create_index(
        "uq_memberships_organization_id_owner",
        "memberships",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("role = 'owner'"),
    )
    op.create_table(
        "oauth_identities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        _created_at(),
        sa.CheckConstraint("provider = 'google'", name=op.f("ck_oauth_identities_provider")),
        sa.CheckConstraint(
            "char_length(subject) BETWEEN 1 AND 255",
            name=op.f("ck_oauth_identities_subject_length"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_oauth_identities_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_oauth_identities")),
    )
    op.create_index(
        "uq_oauth_identities_provider_subject",
        "oauth_identities",
        ["provider", "subject"],
        unique=True,
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        _created_at(),
        sa.CheckConstraint(
            "octet_length(token_hash) = 32", name=op.f("ck_refresh_tokens_token_hash_sha256")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_refresh_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_tokens_token_hash")),
    )
    op.create_index(
        op.f("ix_refresh_tokens_family_id"), "refresh_tokens", ["family_id"], unique=False
    )
    op.create_index(op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False)

    # Auditoría: la aplicación solo agrega y consulta eventos. La anonimización de IP y
    # navegador a los 90 días (RN-027) llegará con su tarea programada, como función propia.
    op.execute("REVOKE UPDATE, DELETE ON audit_log FROM aletheia_app")

    # Soporte nunca ve hashes de contraseñas o de tokens ni identificadores de Google.
    op.execute(
        "REVOKE SELECT ON refresh_tokens, invitations, oauth_identities FROM aletheia_support"
    )
    op.execute("REVOKE SELECT ON users FROM aletheia_support")
    op.execute(
        "GRANT SELECT (id, email, email_verified_at, full_name, status, is_platform_admin, "
        "terms_version, privacy_version, consented_at, created_at, updated_at) "
        "ON users TO aletheia_support"
    )


def downgrade() -> None:
    # Al borrar cada tabla desaparecen también sus permisos.
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_index(op.f("ix_refresh_tokens_family_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("uq_oauth_identities_provider_subject", table_name="oauth_identities")
    op.drop_table("oauth_identities")
    op.drop_index("uq_memberships_organization_id_owner", table_name="memberships")
    op.drop_table("memberships")
    op.drop_table("invitations")
    op.drop_index("ix_audit_log_organization_id_created_at", table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_table("users")
    op.drop_table("organizations")
