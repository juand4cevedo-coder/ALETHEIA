"""Esquemas del perfil de quien tiene la sesión (API-014)."""

import datetime
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
    kind: Literal["individual", "firm"] = Field(
        description=(
            "Cuenta independiente o firma. En una firma el responsable dirige el despacho y no "
            "abre casos (ADR-062)."
        )
    )


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


class MySubscription(BaseModel):
    plan_name: str
    status: str
    access_source: str
    ends_at: datetime.datetime | None


class Me(BaseModel):
    """Perfil, organización y rol de quien tiene la sesión."""

    id: uuid.UUID = Field(description="Identificador de la persona.")
    full_name: str = Field(description="Nombre de la persona.")
    email: str = Field(description="Correo de la cuenta.")
    email_verified: bool = Field(description="Si ya verificó su correo (HU-006).")
    google_linked: bool = Field(description="Si puede ingresar con una identidad de Google.")
    platform_admin: bool = Field(
        description="Es la cuenta dueña de la plataforma y no pertenece a ningún despacho."
    )
    permissions: list[Permission] = Field(
        description="Capacidades vigentes en su despacho o, de forma excluyente, en la plataforma."
    )
    organization: OrganizationMembership | None = Field(
        description="Su organización, o null si ya no pertenece a ninguna."
    )
    subscription: MySubscription | None = None
    legal: LegalStatus = Field(description="Su aceptación de los textos legales.")
    two_factor_setup_required: bool = Field(
        default=False,
        description="Su despacho exige el segundo factor y todavía no lo tiene: solo puede "
        "activarlo.",
    )
