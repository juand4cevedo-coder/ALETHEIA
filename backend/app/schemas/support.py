"""Contrato de solicitudes de soporte sin archivos adjuntos."""

import datetime
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SupportTicketCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: str = Field(min_length=5, max_length=120)
    message: str = Field(min_length=10, max_length=3000)

    @field_validator("subject", "message", mode="before")
    @classmethod
    def strip_text(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        value = value.strip()
        if not value:
            raise ValueError("El texto no puede estar vacío.")
        return value


class SupportTicketOut(BaseModel):
    id: uuid.UUID
    subject: str
    message: str
    status: Literal["open", "closed"]
    created_at: datetime.datetime
    updated_at: datetime.datetime
    closed_at: datetime.datetime | None
    user_email: str | None = None


class SupportTicketPage(BaseModel):
    items: list[SupportTicketOut]
    next_cursor: uuid.UUID | None


class SupportTicketStatusChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["open", "closed"]
