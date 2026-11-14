"""Datos de administración de cuentas sin acceso a los expedientes de los despachos."""

import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PlatformUser(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    status: Literal["active", "blocked"]
    email_verified: bool
    platform_admin: bool
    created_at: datetime.datetime


class PlatformUserPage(BaseModel):
    items: list[PlatformUser]
    next_cursor: uuid.UUID | None


class UserStatusChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["active", "blocked"] = Field(
        description="Estado nuevo de la cuenta. Bloquear cierra todas sus sesiones."
    )


class PlatformPlan(BaseModel):
    code: str
    name: str
    monthly_price_cop: int | None
    annual_price_cop: int | None
    included_users: int
    is_public: bool


class PlatformBilling(BaseModel):
    plans: list[PlatformPlan]
    subscription_counts: dict[str, int]
    payment_events_received: int
    payment_events_pending: int


class PlatformAuditEvent(BaseModel):
    id: uuid.UUID
    action: str
    actor_user_id: uuid.UUID | None
    organization_id: uuid.UUID | None
    target_id: uuid.UUID | None
    created_at: datetime.datetime


class PlatformAuditPage(BaseModel):
    items: list[PlatformAuditEvent]
    next_cursor: uuid.UUID | None
