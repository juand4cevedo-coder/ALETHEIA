"""Comercial: catálogo de planes, suscripciones y notificaciones de la pasarela de pagos."""

import datetime
import uuid
from typing import Any, Final

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Index, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import UUIDv7Pk, text_values

SUBSCRIPTION_STATUSES: Final = ("trial", "active", "past_due", "canceled", "expired")
ACCESS_SOURCES: Final = ("trial", "courtesy", "payment", "legacy")
BILLING_CYCLES: Final = ("none", "monthly", "annual")
PAYMENT_GATEWAYS: Final = ("mercadopago", "wompi")


class Plan(Base):
    """Plan del catálogo con su precio y sus límites (DAT-08). Los límites viven aquí, no en
    el código (RN-019); el administrador de plataforma los edita desde la consola."""

    __tablename__ = "plans"
    __table_args__ = (
        CheckConstraint("code ~ '^[a-z_]{1,30}$'", name="code_format"),
        CheckConstraint("char_length(name) BETWEEN 1 AND 60", name="name_length"),
        CheckConstraint("monthly_price_cop >= 0", name="monthly_price_cop"),
        CheckConstraint("annual_price_cop >= 0", name="annual_price_cop"),
        CheckConstraint("included_users > 0", name="included_users"),
        CheckConstraint("extra_user_price_cop >= 0", name="extra_user_price_cop"),
        CheckConstraint("max_extra_users >= 0", name="max_extra_users"),
        CheckConstraint("storage_limit_bytes > 0", name="storage_limit_bytes"),
        CheckConstraint("max_file_bytes > 0", name="max_file_bytes"),
    )

    id: Mapped[UUIDv7Pk]
    code: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    # Pesos colombianos sin decimales. Nulo cuando el plan no se vende en ese ciclo.
    monthly_price_cop: Mapped[int | None]
    annual_price_cop: Mapped[int | None]
    included_users: Mapped[int]
    extra_user_price_cop: Mapped[int | None]
    # Cuántos adicionales admite sobre los incluidos. Nulo con precio de adicional: sin tope
    # (Corporativo). Sin precio de adicional, el plan no admite ninguno (ADR-062).
    max_extra_users: Mapped[int | None]
    storage_limit_bytes: Mapped[int] = mapped_column(BigInteger)
    max_file_bytes: Mapped[int] = mapped_column(BigInteger)
    # Visible en la página de precios; Corporativo se vende por cotización.
    is_public: Mapped[bool]


class Subscription(Base):
    """Estado comercial de una organización: una suscripción vigente por organización (DAT-09)."""

    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint(text_values("status", SUBSCRIPTION_STATUSES), name="status"),
        CheckConstraint(text_values("billing_cycle", BILLING_CYCLES), name="billing_cycle"),
        CheckConstraint(text_values("access_source", ACCESS_SOURCES), name="access_source"),
        CheckConstraint(
            "courtesy_reason IS NULL OR char_length(courtesy_reason) BETWEEN 10 AND 500",
            name="courtesy_reason_length",
        ),
        # Una prueba siempre sabe cuándo termina (RN-017).
        CheckConstraint("status <> 'trial' OR trial_ends_at IS NOT NULL", name="trial_ends_at"),
        CheckConstraint(
            "char_length(gateway_subscription_id) BETWEEN 1 AND 100",
            name="gateway_subscription_id_length",
        ),
        CheckConstraint(
            "char_length(pending_checkout_reference) BETWEEN 1 AND 255",
            name="pending_checkout_reference_length",
        ),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT"), unique=True
    )
    # Un plan en uso no se puede borrar.
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id", ondelete="RESTRICT"))
    status: Mapped[str]
    billing_cycle: Mapped[str]
    access_source: Mapped[str] = mapped_column(server_default="legacy")
    trial_ends_at: Mapped[datetime.datetime | None]
    # Una cortesía activa puede no tener fecha; su concesión llega con HU-116.
    courtesy_ends_at: Mapped[datetime.datetime | None]
    courtesy_reason: Mapped[str | None]
    courtesy_granted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    courtesy_granted_at: Mapped[datetime.datetime | None]
    courtesy_revoked_at: Mapped[datetime.datetime | None]
    current_period_end: Mapped[datetime.datetime | None]
    # Fin de los 30 días de solo lectura después de cancelar (RN-016).
    read_only_until: Mapped[datetime.datetime | None]
    gateway_subscription_id: Mapped[str | None] = mapped_column(unique=True)
    # La referencia del cobro en curso, mientras no llega un estado final de Wompi (HU-027):
    # bloquea un segundo cobro sobre la misma suscripción (RN-032).
    pending_checkout_reference: Mapped[str | None] = mapped_column(unique=True)


class PaymentEvent(Base):
    """Notificación recibida de la pasarela; cada evento se procesa una sola vez (DAT-10)."""

    __tablename__ = "payment_events"
    __table_args__ = (
        CheckConstraint(text_values("gateway", PAYMENT_GATEWAYS), name="gateway"),
        CheckConstraint(
            "char_length(gateway_event_id) BETWEEN 1 AND 100", name="gateway_event_id_length"
        ),
        CheckConstraint("char_length(event_type) BETWEEN 1 AND 60", name="event_type_length"),
        # Idempotencia: la misma notificación repetida choca con este índice (IDX-009, RN-018).
        Index(
            "uq_payment_events_gateway_gateway_event_id",
            "gateway",
            "gateway_event_id",
            unique=True,
        ),
    )

    id: Mapped[UUIDv7Pk]
    gateway: Mapped[str]
    gateway_event_id: Mapped[str]
    event_type: Mapped[str]
    # Una notificación con firma inválida se registra, pero nunca activa un plan.
    signature_valid: Mapped[bool]
    # Solo los campos necesarios de la notificación; nunca datos de tarjeta.
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    received_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
    processed_at: Mapped[datetime.datetime | None]


class PaymentReceipt(Base):
    """Comprobante de pago de ALETHEIA: uno por cada pago aprobado, numerado en orden. Mientras
    el operador no esté obligado a facturar, es el documento que se entrega por cada cobro."""

    __tablename__ = "payment_receipts"
    __table_args__ = (
        CheckConstraint("amount_cop > 0", name="amount_cop"),
        CheckConstraint("extra_users >= 0", name="extra_users"),
        CheckConstraint(
            "extra_users_cop >= 0 AND extra_users_cop < amount_cop", name="extra_users_cop"
        ),
        CheckConstraint("billing_cycle IN ('monthly', 'annual')", name="billing_cycle"),
        CheckConstraint("char_length(number) BETWEEN 1 AND 30", name="number"),
        Index("ix_payment_receipts_organization_id_issued_at", "organization_id", "issued_at"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT")
    )
    # Un solo comprobante por pago: la notificación repetida no emite otro.
    payment_event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payment_events.id", ondelete="RESTRICT"), unique=True
    )
    number: Mapped[str] = mapped_column(unique=True)
    gateway_transaction_id: Mapped[str]
    payment_method: Mapped[str | None]
    amount_cop: Mapped[int] = mapped_column(BigInteger)
    # Los usuarios adicionales cobrados en este pago y lo que sumaron; el resto es el plan.
    extra_users: Mapped[int] = mapped_column(server_default="0")
    extra_users_cop: Mapped[int] = mapped_column(BigInteger, server_default="0")
    plan_name: Mapped[str]
    billing_cycle: Mapped[str]
    period_start: Mapped[datetime.datetime]
    period_end: Mapped[datetime.datetime]
    buyer_name: Mapped[str]
    buyer_email: Mapped[str | None]
    issued_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())


class PaymentSource(Base):
    """Fuente de pago que una organización vincula para renovar su plan sin intervención.

    Guarda el consentimiento exacto que dio la persona y el identificador de la fuente en la
    pasarela; nunca datos de pago. Una sola fuente viva (en trámite o activa) por organización.
    """

    __tablename__ = "payment_sources"
    __table_args__ = (
        CheckConstraint("kind IN ('nequi')", name="kind"),
        CheckConstraint("status IN ('pending', 'active', 'declined', 'canceled')", name="status"),
        CheckConstraint("char_length(phone_last4) = 4", name="phone_last4"),
        CheckConstraint(
            "status <> 'active' OR gateway_source_id IS NOT NULL", name="active_has_source"
        ),
        Index(
            "uq_payment_sources_one_live_per_organization",
            "organization_id",
            unique=True,
            postgresql_where=text("status IN ('pending', 'active')"),
        ),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT")
    )
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    kind: Mapped[str]
    status: Mapped[str]
    gateway_token: Mapped[str | None]
    gateway_source_id: Mapped[int | None] = mapped_column(BigInteger)
    phone_last4: Mapped[str]
    consent_version: Mapped[str]
    consent_accepted_at: Mapped[datetime.datetime]
    consent_ip: Mapped[str | None]
    linked_at: Mapped[datetime.datetime | None]
    canceled_at: Mapped[datetime.datetime | None]
    canceled_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    created_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())


TRIAL_EMAIL_STAGES: Final = ("day_0", "day_3", "day_7", "day_11", "day_14")


class TrialEmail(Base):
    """Cada correo del ciclo de la prueba que ya le tocó a una organización. La llave primaria
    impide que el mismo correo salga dos veces. `emailed` es falso cuando la etapa se dio por
    pasada sin enviarla, porque ya había llegado la siguiente."""

    __tablename__ = "trial_emails"
    __table_args__ = (CheckConstraint(text_values("stage", TRIAL_EMAIL_STAGES), name="stage"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True
    )
    stage: Mapped[str] = mapped_column(primary_key=True)
    emailed: Mapped[bool]
    created_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
