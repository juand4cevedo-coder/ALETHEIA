"""Contrato del resumen, el directorio de despachos y la operación de la plataforma."""

import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class _FromService(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PlatformExpiring(_FromService):
    organization_id: uuid.UUID
    organization_name: str
    plan_name: str
    access_source: str
    ends_at: datetime.datetime


class PlatformRecentAccount(_FromService):
    id: uuid.UUID
    full_name: str
    email: str
    created_at: datetime.datetime


class PlatformSignupDay(BaseModel):
    day: datetime.date
    accounts: int


class PlatformOverview(_FromService):
    accounts_total: int
    accounts_new_7_days: int
    accounts_new_30_days: int
    accounts_blocked: int
    organizations_total: int
    organizations_read_only: int
    subscriptions: dict[str, int] = Field(description="Suscripciones por estado.")
    collected_30_days_cop: int
    receipts_30_days: int
    tickets_open: int
    tickets_overdue: int = Field(description="Solicitudes abiertas con el plazo vencido.")
    tickets_due_soon: int = Field(description="Abiertas que vencen en los próximos 7 días.")
    jobs_failed: int
    jobs_waiting: int
    payment_events_pending: int
    storage_used_bytes: int
    expiring: list[PlatformExpiring]
    recent_accounts: list[PlatformRecentAccount]
    signups: list[PlatformSignupDay] = Field(description="Cuentas nuevas en los últimos 30 días.")


class PlatformOrganization(_FromService):
    id: uuid.UUID
    name: str
    kind: Literal["individual", "firm"]
    status: str
    owner_name: str | None
    owner_email: str | None
    members: int
    plan_name: str | None
    subscription_status: str | None
    access_source: str | None
    billing_cycle: str | None
    ends_at: datetime.datetime | None
    storage_used_bytes: int
    storage_limit_bytes: int | None
    created_at: datetime.datetime


class PlatformOrganizationPage(_FromService):
    items: list[PlatformOrganization]
    total: int
    next_cursor: uuid.UUID | None


class PlatformJobKind(_FromService):
    kind: str
    queued: int
    running: int
    failed: int
    done_24_hours: int
    oldest_waiting_at: datetime.datetime | None


class PlatformFailedJob(_FromService):
    id: uuid.UUID
    kind: str
    attempts: int
    failed_at: datetime.datetime
    error: str | None = Field(description="Solo el tipo de error, nunca su mensaje.")


class PlatformOperations(_FromService):
    kinds: list[PlatformJobKind]
    failed: list[PlatformFailedJob]
    payment_events_pending: int
    oldest_payment_event_at: datetime.datetime | None
