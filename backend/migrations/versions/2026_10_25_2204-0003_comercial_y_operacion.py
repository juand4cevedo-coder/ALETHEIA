"""comercial y operación

Revisión: 0003
Anterior: 0002
Creada: 2026-10-25

Crea el catálogo de planes con sus cinco planes (sección 6 de la especificación, RN-014,
RN-017 y RN-019), las suscripciones, las notificaciones de la pasarela y la cola de tareas
en segundo plano.
"""

import datetime
import uuid
from collections.abc import Sequence
from typing import Final

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Las cuotas se miden en unidades binarias, como las muestra Windows al ver un archivo:
# un archivo que el sistema operativo marca como de 100 MB cabe en un límite de 100 MB.
_MIB: Final = 1024**2
_GIB: Final = 1024**3
_TIB: Final = 1024**4


def _created_at(name: str) -> sa.Column[datetime.datetime]:
    # Momento en UTC, puesto por PostgreSQL.
    return sa.Column(
        name, sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def upgrade() -> None:
    plans = op.create_table(
        "plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("monthly_price_cop", sa.Integer(), nullable=True),
        sa.Column("annual_price_cop", sa.Integer(), nullable=True),
        sa.Column("included_users", sa.Integer(), nullable=False),
        sa.Column("extra_user_price_cop", sa.Integer(), nullable=True),
        sa.Column("storage_limit_bytes", sa.BigInteger(), nullable=False),
        sa.Column("max_file_bytes", sa.BigInteger(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.CheckConstraint("code ~ '^[a-z_]{1,30}$'", name=op.f("ck_plans_code_format")),
        sa.CheckConstraint("annual_price_cop >= 0", name=op.f("ck_plans_annual_price_cop")),
        sa.CheckConstraint("char_length(name) BETWEEN 1 AND 60", name=op.f("ck_plans_name_length")),
        sa.CheckConstraint("extra_user_price_cop >= 0", name=op.f("ck_plans_extra_user_price_cop")),
        sa.CheckConstraint("included_users > 0", name=op.f("ck_plans_included_users")),
        sa.CheckConstraint("max_file_bytes > 0", name=op.f("ck_plans_max_file_bytes")),
        sa.CheckConstraint("monthly_price_cop >= 0", name=op.f("ck_plans_monthly_price_cop")),
        sa.CheckConstraint("storage_limit_bytes > 0", name=op.f("ck_plans_storage_limit_bytes")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plans")),
        sa.UniqueConstraint("code", name=op.f("uq_plans_code")),
    )
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("billing_cycle", sa.Text(), nullable=False),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_only_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("gateway_subscription_id", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "billing_cycle IN ('none', 'monthly', 'annual')",
            name=op.f("ck_subscriptions_billing_cycle"),
        ),
        sa.CheckConstraint(
            "status <> 'trial' OR trial_ends_at IS NOT NULL",
            name=op.f("ck_subscriptions_trial_ends_at"),
        ),
        sa.CheckConstraint(
            "status IN ('trial', 'active', 'past_due', 'canceled', 'expired')",
            name=op.f("ck_subscriptions_status"),
        ),
        sa.CheckConstraint(
            "char_length(gateway_subscription_id) BETWEEN 1 AND 100",
            name=op.f("ck_subscriptions_gateway_subscription_id_length"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_subscriptions_organization_id_organizations"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"],
            ["plans.id"],
            name=op.f("fk_subscriptions_plan_id_plans"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_subscriptions")),
        sa.UniqueConstraint(
            "gateway_subscription_id", name=op.f("uq_subscriptions_gateway_subscription_id")
        ),
        sa.UniqueConstraint("organization_id", name=op.f("uq_subscriptions_organization_id")),
    )
    op.create_table(
        "payment_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("gateway", sa.Text(), nullable=False),
        sa.Column("gateway_event_id", sa.Text(), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("signature_valid", sa.Boolean(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        _created_at("received_at"),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "gateway IN ('mercadopago', 'wompi')", name=op.f("ck_payment_events_gateway")
        ),
        sa.CheckConstraint(
            "char_length(event_type) BETWEEN 1 AND 60",
            name=op.f("ck_payment_events_event_type_length"),
        ),
        sa.CheckConstraint(
            "char_length(gateway_event_id) BETWEEN 1 AND 100",
            name=op.f("ck_payment_events_gateway_event_id_length"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment_events")),
    )
    op.create_index(
        "uq_payment_events_gateway_gateway_event_id",
        "payment_events",
        ["gateway", "gateway_event_id"],
        unique=True,
    )
    op.create_table(
        "jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="queued", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        _created_at("run_after"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "kind IN ('tsa_stamp', 'export_build', 'email_send', 'case_purge', "
            "'payment_reconcile', 'export_expire', 'audit_anonymize', 'subscription_expire')",
            name=op.f("ck_jobs_kind"),
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'done', 'dead')", name=op.f("ck_jobs_status")
        ),
        sa.CheckConstraint("attempts >= 0", name=op.f("ck_jobs_attempts")),
        sa.CheckConstraint(
            "char_length(idempotency_key) BETWEEN 1 AND 200",
            name=op.f("ck_jobs_idempotency_key_length"),
        ),
        sa.CheckConstraint(
            "char_length(last_error) <= 500", name=op.f("ck_jobs_last_error_length")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_jobs")),
        sa.UniqueConstraint("idempotency_key", name=op.f("uq_jobs_idempotency_key")),
    )
    op.create_index(
        "ix_jobs_run_after_queued",
        "jobs",
        ["run_after"],
        unique=False,
        postgresql_where=sa.text("status = 'queued'"),
    )

    # Catálogo inicial. Prueba es gratis y no se vende por año; Corporativo se cotiza, así
    # que su precio mensual es el punto de partida y no aparece en la página de precios.
    op.bulk_insert(
        plans,
        [
            {
                "id": uuid.uuid7(),
                "code": code,
                "name": name,
                "monthly_price_cop": monthly,
                "annual_price_cop": annual,
                "included_users": users,
                "extra_user_price_cop": extra_user,
                "storage_limit_bytes": storage,
                "max_file_bytes": max_file,
                "is_public": is_public,
            }
            for code, name, monthly, annual, users, extra_user, storage, max_file, is_public in (
                ("trial", "Prueba", 0, None, 1, None, 1 * _GIB, 100 * _MIB, True),
                ("essential", "Esencial", 29_900, 299_000, 1, None, 10 * _GIB, 250 * _MIB, True),
                (
                    "professional",
                    "Profesional",
                    59_900,
                    599_000,
                    2,
                    None,
                    50 * _GIB,
                    1 * _GIB,
                    True,
                ),
                ("firm", "Firma", 149_900, 1_499_000, 8, 14_900, 200 * _GIB, 2 * _GIB, True),
                ("corporate", "Corporativo", 449_900, None, 25, None, 1 * _TIB, 5 * _GIB, False),
            )
        ],
    )

    # Una notificación de pago es un registro contable: la aplicación no la edita ni la
    # borra, solo marca cuándo la procesó.
    op.execute("REVOKE UPDATE, DELETE ON payment_events FROM aletheia_app")
    op.execute("GRANT UPDATE (processed_at) ON payment_events TO aletheia_app")


def downgrade() -> None:
    # Al borrar cada tabla desaparecen también sus filas y sus permisos.
    op.drop_index("ix_jobs_run_after_queued", table_name="jobs")
    op.drop_table("jobs")
    op.drop_index("uq_payment_events_gateway_gateway_event_id", table_name="payment_events")
    op.drop_table("payment_events")
    op.drop_table("subscriptions")
    op.drop_table("plans")
