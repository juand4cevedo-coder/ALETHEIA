"""Esquemas del perfil de quien tiene la sesión (API-014)."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.core.permissions import Permission

# Los mismos roles de memberships.role (RN-010).
MemberRole = Literal["owner", "admin", "lawyer", "assistant"]


class OrganizationMembership(BaseModel):
    """La organización de la persona y su rol en ella."""

    id: uuid.UUID = Field(description="Identificador de la organización.")
    name: str = Field(description="Nombre de la oficina, la firma o la persona independiente.")
    role: MemberRole = Field(description="Rol de la persona en la organización.")


class LegalStatus(BaseModel):
    """Qué textos legales aceptó la persona y si debe aceptar unos nuevos (RN-029)."""

    accepted_version: str = Field(
        description="Fecha (AAAA-MM-DD) de los textos que la persona aceptó por última vez."
    )
    current_version: str = Field(description="Fecha (AAAA-MM-DD) de los textos vigentes.")
    acceptance_required: bool = Field(
        description="Si debe aceptar los textos vigentes antes de seguir usando el servicio."
    )


class LegalAcceptanceRequest(BaseModel):
    """Aceptación expresa de los textos legales vigentes."""

    legal_version: str = Field(
        max_length=20,
        description="Fecha de los textos que la persona leyó y acepta; debe ser la vigente.",
    )
    accepts_legal_terms: Literal[True] = Field(
        description=(
            "Acepta los términos y autoriza el tratamiento de sus datos. Nunca se presume: "
            "la interfaz lo envía solo si la persona marcó la casilla."
        )
    )


class Me(BaseModel):
    """Perfil, organización y rol de quien tiene la sesión."""

    id: uuid.UUID = Field(description="Identificador de la persona.")
    full_name: str = Field(description="Nombre de la persona.")
    email: str = Field(description="Correo de la cuenta.")
    email_verified: bool = Field(description="Si ya verificó su correo (HU-006).")
    platform_admin: bool = Field(
        description="Puede administrar la plataforma; no concede acceso a otros despachos."
    )
    permissions: list[Permission] = Field(
        description="Capacidades vigentes en su despacho y, por separado, en la plataforma."
    )
    organization: OrganizationMembership | None = Field(
        description="Su organización, o null si ya no pertenece a ninguna."
    )
    legal: LegalStatus = Field(description="Su aceptación de los textos legales.")
