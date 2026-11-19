"""Datos de administración de cuentas sin acceso a los expedientes de los despachos."""

import datetime
import uuid
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


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


class CourtesyTarget(BaseModel):
    organization_id: uuid.UUID
    organization_name: str
    owner_email: str
    owner_name: str
    plan_code: str
    status: str
    access_source: str
    ends_at: datetime.datetime | None
    granted_at: datetime.datetime | None
    revoked_at: datetime.datetime | None


class CourtesyGrant(BaseModel):
    model_config = ConfigDict(extra="forbid")

    organization_id: uuid.UUID
    owner_email: str
    plan_code: str
    reason: str = Field(min_length=10, max_length=500)
    ends_at: AwareDatetime | None = None


class CourtesyRevoke(BaseModel):
    model_config = ConfigDict(extra="forbid")

    organization_id: uuid.UUID
    owner_email: str
    reason: str = Field(min_length=10, max_length=500)


class PlatformAuditEvent(BaseModel):
    id: uuid.UUID
    action: str
    actor_user_id: uuid.UUID | None
    actor_name: str | None = Field(description="Nombre de quien actuó, o null si ya no existe.")
    organization_id: uuid.UUID | None
    organization_name: str | None = Field(
        description="Nombre del despacho, o null si ya no existe."
    )
    target_id: uuid.UUID | None
    created_at: datetime.datetime


class PlatformAuditPage(BaseModel):
    items: list[PlatformAuditEvent]
    next_cursor: uuid.UUID | None
