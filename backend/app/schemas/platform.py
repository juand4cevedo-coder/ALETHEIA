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
