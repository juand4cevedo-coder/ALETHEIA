"""Comercial: catálogo de planes, suscripciones y notificaciones de la pasarela de pagos."""

import datetime
import uuid
from typing import Any, Final

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import UUIDv7Pk, text_values

SUBSCRIPTION_STATUSES: Final = ("trial", "active", "past_due", "canceled", "expired")
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
        # Una prueba siempre sabe cuándo termina (RN-017).
        CheckConstraint("status <> 'trial' OR trial_ends_at IS NOT NULL", name="trial_ends_at"),
        CheckConstraint(
            "char_length(gateway_subscription_id) BETWEEN 1 AND 100",
            name="gateway_subscription_id_length",
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
    trial_ends_at: Mapped[datetime.datetime | None]
    current_period_end: Mapped[datetime.datetime | None]
    # Fin de los 30 días de solo lectura después de cancelar (RN-016).
    read_only_until: Mapped[datetime.datetime | None]
    gateway_subscription_id: Mapped[str | None] = mapped_column(unique=True)


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
