"""Contrato de los enlaces para compartir una evidencia."""

import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ShareLinkCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    expires_in_hours: int = Field(
        default=24, ge=1, le=24 * 30, description="Horas de vigencia del enlace, hasta 30 días."
    )
    label: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
        description="Nota para quien administra, por ejemplo a quién se le envió.",
    )


class ShareLinkOut(BaseModel):
    id: uuid.UUID
    label: str | None
    created_by_name: str
    created_at: datetime.datetime
    expires_at: datetime.datetime
    revoked_at: datetime.datetime | None
    status: Literal["active", "expired", "revoked"]
    download_count: int
    last_downloaded_at: datetime.datetime | None


class ShareLinkCreated(BaseModel):
    link: ShareLinkOut
    url: str = Field(description="El enlace completo. Se muestra una sola vez.")


class ShareLinkList(BaseModel):
    items: list[ShareLinkOut]


class SharedEvidenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=4096)


class SharedEvidenceInfo(BaseModel):
    filename: str
    size_bytes: int
    sha256: str = Field(description="Huella SHA-256 en hexadecimal, para comprobar el archivo.")
    expires_at: datetime.datetime
