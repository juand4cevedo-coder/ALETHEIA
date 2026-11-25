"""Contrato de las solicitudes de cotización del plan Corporativo."""

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.schemas.common import Email

_Line = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]


class SalesInquiryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: _Line = Field(description="Nombre de quien escribe.")
    organization: _Line = Field(description="Firma, oficina o entidad.")
    email: Email = Field(description="Correo al que se responde la cotización.")
    users: int = Field(ge=1, le=10_000, description="Número aproximado de usuarios.")
    message: str | None = Field(
        default=None, max_length=2000, description="Cómo trabaja el despacho, si quiere contarlo."
    )

    @field_validator("message", mode="before")
    @classmethod
    def strip_message(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class SalesInquiryAccepted(BaseModel):
    filing_number: str = Field(description="Radicado de la solicitud.")
    detail: str
