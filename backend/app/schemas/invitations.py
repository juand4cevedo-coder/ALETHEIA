"""Esquemas para abrir y aceptar una invitación (API-019 y API-052, HU-012)."""

import datetime
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.core.passwords import MAX_LENGTH, MIN_LENGTH, normalize
from app.schemas.organization import InvitableRole

# Un token legítimo mide 43 caracteres; el tope deja margen sin aceptar cuerpos enormes.
_Token = Annotated[str, StringConstraints(min_length=1, max_length=64)]
_Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class InvitationTokenRequest(BaseModel):
    """El token del enlace de la invitación (API-052)."""

    model_config = ConfigDict(extra="forbid")

    token: _Token = Field(description="Token del fragmento del enlace (#t=…).")


class InvitationPreview(BaseModel):
    """Lo que la persona invitada ve antes de aceptar (UI-011)."""

    organization_name: str = Field(description="Organización que invita.")
    inviter_name: str = Field(description="Quién envió la invitación.")
    email: str = Field(description="Correo invitado; será el de acceso.")
    role: InvitableRole = Field(description="Rol ofrecido.")
    expires_at: datetime.datetime = Field(description="Cuándo vence la invitación.")
    account: Literal["new", "existing", "member_elsewhere"] = Field(
        description=(
            "new si el correo no tiene cuenta; existing si la tiene y no pertenece a ninguna "
            "organización; member_elsewhere si ya pertenece a una (RN-011)."
        )
    )


class AcceptInvitationRequest(BaseModel):
    """Aceptar la invitación (API-019).

    Con full_name se crea una cuenta nueva: la contraseña es la nueva y debe aceptar los textos
    legales vigentes. Sin full_name, la persona ya tiene cuenta y la contraseña es la suya.
    """

    model_config = ConfigDict(extra="forbid")

    token: _Token = Field(description="Token del fragmento del enlace (#t=…).")
    password: str = Field(
        min_length=1,
        max_length=MAX_LENGTH,
        description=(
            f"Contraseña nueva de {MIN_LENGTH} a {MAX_LENGTH} caracteres para una cuenta nueva, "
            "o la contraseña de la cuenta existente."
        ),
    )
    full_name: _Name | None = Field(
        default=None, description="Nombre de la persona. Solo para una cuenta nueva."
    )
    legal_version: str | None = Field(
        default=None,
        max_length=20,
        description="Versión de los textos que vio la persona. Solo para una cuenta nueva.",
    )
    accepts_legal_terms: Literal[True] | None = Field(
        default=None,
        description=(
            "Acepta los términos y autoriza el tratamiento de sus datos. Obligatorio para una "
            "cuenta nueva; nunca se presume."
        ),
    )

    @model_validator(mode="after")
    def _new_account_rules(self) -> Self:
        if self.full_name is None:
            return self
        # Cuenta nueva: la misma regla de contraseña del registro (RN-025) y la aceptación
        # expresa de los textos (RN-029).
        if not MIN_LENGTH <= len(normalize(self.password)) <= MAX_LENGTH:
            msg = f"La contraseña debe tener entre {MIN_LENGTH} y {MAX_LENGTH} caracteres."
            raise ValueError(msg)
        if self.accepts_legal_terms is not True or self.legal_version is None:
            msg = "Para crear la cuenta debe aceptar los términos y la política de privacidad."
            raise ValueError(msg)
        return self


class InvitationAccepted(BaseModel):
    """A dónde entró la persona al aceptar."""

    organization_name: str = Field(description="Organización a la que entró.")
    role: InvitableRole = Field(description="Su rol en la organización.")
