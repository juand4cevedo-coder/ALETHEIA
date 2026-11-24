"""Contrato de solicitudes de soporte sin archivos adjuntos."""

import datetime
import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.support import TicketCategory


class SupportTicketCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: TicketCategory = Field(
        default="support",
        description=(
            "support: ayuda con el servicio; data_query: consulta sobre datos personales; "
            "data_claim: corregir, actualizar o suprimir datos; consumer: petición, queja o "
            "reclamo de consumidor; refund: devolución de un pago."
        ),
    )
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
    filing_number: str = Field(description="Radicado con el que se consulta la solicitud.")
    category: TicketCategory
    subject: str
    message: str
    status: Literal["open", "closed"]
    due_on: datetime.date = Field(description="Último día para responder, hora de Colombia.")
    created_at: datetime.datetime
    updated_at: datetime.datetime
    closed_at: datetime.datetime | None
    deletable_on: datetime.date | None = Field(
        default=None,
        description=(
            "Desde qué día la plataforma puede eliminarla: al resolverse si es de soporte; tres "
            "años después de cerrada si es de datos personales, consumidor o reembolso."
        ),
    )
    user_email: str | None = None


class SupportTicketPage(BaseModel):
    items: list[SupportTicketOut]
    next_cursor: uuid.UUID | None


class SupportTicketStatusChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["open", "closed"]
