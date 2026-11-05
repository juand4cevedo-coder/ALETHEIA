"""Esquemas del perfil de quien tiene la sesión (API-014)."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field

# Los mismos roles de memberships.role (RN-010).
MemberRole = Literal["owner", "admin", "lawyer", "assistant"]


class OrganizationMembership(BaseModel):
    """La organización de la persona y su rol en ella."""

    id: uuid.UUID = Field(description="Identificador de la organización.")
    name: str = Field(description="Nombre de la oficina, la firma o la persona independiente.")
    role: MemberRole = Field(description="Rol de la persona en la organización.")


class Me(BaseModel):
    """Perfil, organización y rol de quien tiene la sesión."""

    id: uuid.UUID = Field(description="Identificador de la persona.")
    full_name: str = Field(description="Nombre de la persona.")
    email: str = Field(description="Correo de la cuenta.")
    email_verified: bool = Field(description="Si ya verificó su correo (HU-006).")
    organization: OrganizationMembership | None = Field(
        description="Su organización, o null si ya no pertenece a ninguna."
    )
