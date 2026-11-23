"""Contrato del portal del cliente (ADR-054)."""

import datetime
import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.core.tokens import MAX_TOKEN_LENGTH
from app.schemas.common import Email

_Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class PortalInvite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_name: _Name = Field(description="Nombre del cliente, como lo verá en el correo.")
    client_email: Email = Field(description="Correo al que llega el enlace del portal.")


class PortalAccessOut(BaseModel):
    id: uuid.UUID
    client_name: str
    client_email: str
    status: Literal["active", "expired", "revoked"]
    created_by_name: str
    created_at: datetime.datetime
    expires_at: datetime.datetime
    notice_accepted_at: datetime.datetime | None
    last_visit_at: datetime.datetime | None


class PortalAccessList(BaseModel):
    items: list[PortalAccessOut]


class PortalUpdateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    body: str = Field(
        min_length=1,
        max_length=2000,
        description="Aviso para el cliente. Es lo único del caso que el portal le muestra.",
    )


class PortalUpdateOut(BaseModel):
    id: uuid.UUID
    author_name: str
    body: str
    created_at: datetime.datetime


class PortalUpdateList(BaseModel):
    items: list[PortalUpdateOut]


class PortalTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=MAX_TOKEN_LENGTH, description="Token del enlace.")


class PortalMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    token: str = Field(min_length=1, max_length=MAX_TOKEN_LENGTH, description="Token del enlace.")
    body: str = Field(min_length=1, max_length=2000, description="Mensaje para el despacho.")


class PortalMessageOut(BaseModel):
    id: uuid.UUID
    body: str
    created_at: datetime.datetime


class PortalInboxMessage(BaseModel):
    """Un mensaje de un cliente, como lo ve el despacho."""

    id: uuid.UUID
    client_name: str
    body: str
    created_at: datetime.datetime
    read_at: datetime.datetime | None


class PortalInbox(BaseModel):
    items: list[PortalInboxMessage]
    unread_count: int


class PortalRenewed(BaseModel):
    """La misma respuesta haya o no un acceso que renovar."""

    detail: str


class PortalView(BaseModel):
    """Lo que ve el cliente. Hasta que acepte el aviso de datos no recibe el caso."""

    organization_name: str
    client_name: str
    notice_accepted: bool
    case_title: str | None
    case_status: Literal["open", "closed"] | None
    updates: list[PortalUpdateOut]
    messages: list[PortalMessageOut]
    expires_at: datetime.datetime
