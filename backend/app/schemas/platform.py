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
    total: int = Field(description="Cuentas que coinciden con los filtros, sin limitar por página.")


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
    extra_user_price_cop: int | None
    is_public: bool


class PlanUpdate(BaseModel):
    """Los campos que la plataforma edita de un plan. Los que no se envían no cambian."""

    model_config = ConfigDict(extra="forbid")

    monthly_price_cop: int | None = Field(default=None, ge=0, le=100_000_000)
    annual_price_cop: int | None = Field(default=None, ge=0, le=1_000_000_000)
    included_users: int | None = Field(default=None, ge=1, le=10_000)
    extra_user_price_cop: int | None = Field(default=None, ge=0, le=100_000_000)
    is_public: bool | None = None
    clear_extra_user_price: bool = Field(
        default=False, description="Quita el usuario adicional: el plan ya no lo admite."
    )


class PlatformBilling(BaseModel):
    plans: list[PlatformPlan]
    subscription_counts: dict[str, int]
    payment_events_received: int
    payment_events_pending: int
    collected_year: int
    receipts_year: int
    collected_year_cop: int
    invoicing_threshold_uvt: int
    uvt_value_cop: int
    invoicing_threshold_cop: int


class CourtesyTarget(BaseModel):
    organization_id: uuid.UUID
    organization_name: str
    account_email: str
    account_name: str
    plan_code: str
    status: str
    access_source: str
    ends_at: datetime.datetime | None
    granted_at: datetime.datetime | None
    revoked_at: datetime.datetime | None


class CourtesyGrant(BaseModel):
    model_config = ConfigDict(extra="forbid")

    organization_id: uuid.UUID
    account_email: str
    plan_code: str
    reason: str = Field(min_length=10, max_length=500)
    ends_at: AwareDatetime | None = None


class CourtesyRevoke(BaseModel):
    model_config = ConfigDict(extra="forbid")

    organization_id: uuid.UUID
    account_email: str
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
    total: int = Field(description="Eventos que coinciden con los filtros, sin limitar por página.")


class OrganizationDeletionRequest(BaseModel):
    """Confirmación del cierre de un despacho: su nombre exacto."""

    model_config = ConfigDict(extra="forbid")

    confirmation: str = Field(
        min_length=1,
        max_length=120,
        description="El nombre del despacho, escrito tal cual, para confirmar.",
    )


class AccountDeletionRequest(BaseModel):
    """Confirmación de una eliminación definitiva: el correo exacto de la cuenta."""

    model_config = ConfigDict(extra="forbid")

    confirmation: str = Field(
        min_length=3,
        max_length=320,
        description="El correo de la cuenta, escrito tal cual, para confirmar.",
    )
