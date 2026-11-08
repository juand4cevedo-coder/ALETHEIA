"""Esquemas de los miembros y las invitaciones de la organización (API-015 a API-018)."""

import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Email
from app.schemas.me import MemberRole

# Los mismos roles de invitations.role: el propietario no se invita, nace con la organización.
InvitableRole = Literal["admin", "lawyer", "assistant"]


# Tamaño de página por defecto y máximo de las listas paginadas por cursor.
PAGE_SIZE_DEFAULT = 50
PAGE_SIZE_MAX = 100


class InvitationRequest(BaseModel):
    """Correo y rol de la persona invitada (API-016)."""

    model_config = ConfigDict(extra="forbid")

    email: Email = Field(description="Correo al que llega la invitación.")
    role: InvitableRole = Field(description="Rol con que entrará: admin, lawyer o assistant.")


class InvitationOut(BaseModel):
    """Una invitación sin aceptar ni revocar."""

    id: uuid.UUID = Field(description="Identificador de la invitación.")
    email: str = Field(description="Correo invitado.")
    role: InvitableRole = Field(description="Rol ofrecido.")
    invited_at: datetime.datetime = Field(description="Cuándo se envió.")
    expires_at: datetime.datetime = Field(description="Cuándo vence: 72 horas después.")
    expired: bool = Field(description="Si ya venció sin que la aceptaran.")


class InvitationPage(BaseModel):
    """Invitaciones pendientes, de la más reciente a la más antigua (API-017)."""

    items: list[InvitationOut] = Field(description="Invitaciones de esta página.")
    next_cursor: uuid.UUID | None = Field(
        description="Cursor para la página siguiente, o null si no hay más."
    )


class MemberOut(BaseModel):
    """Una persona de la organización y su rol."""

    user_id: uuid.UUID = Field(description="Identificador de la persona.")
    full_name: str = Field(description="Nombre de la persona.")
    email: str = Field(description="Correo de la persona.")
    role: MemberRole = Field(description="Rol en la organización.")
    joined_at: datetime.datetime = Field(description="Cuándo entró a la organización.")


class SeatsOut(BaseModel):
    """Cupo de usuarios del plan (RN-012)."""

    used: int = Field(description="Miembros más invitaciones abiertas.")
    included: int = Field(description="Usuarios que incluye el plan.")
    extra_user_price_cop: int | None = Field(
        description="Precio mensual de cada usuario adicional, o null si el plan no los admite."
    )
    full: bool = Field(description="Si ya no cabe nadie más sin cambiar de plan.")


class MemberPage(BaseModel):
    """Miembros en el orden en que llegaron, con el cupo del plan (API-015)."""

    items: list[MemberOut] = Field(description="Miembros de esta página.")
    next_cursor: uuid.UUID | None = Field(
        description="Cursor para la página siguiente, o null si no hay más."
    )
    seats: SeatsOut = Field(description="Cupo de usuarios del plan.")
