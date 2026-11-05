"""Esquemas de la cuenta y del acceso."""

from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
)

from app.core.passwords import MAX_LENGTH, MIN_LENGTH, normalize

# Texto visible: sin espacios sobrantes y nunca vacío. Va como alias simple, no con type, para
# que el contrato lo describa en cada campo y no como un esquema aparte.
_Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]

# Correo: sin espacios, en minúsculas y con la forma mínima de una dirección.
_Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        max_length=254,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    ),
]

# Una cuenta es de una persona que trabaja por su cuenta o de una oficina o firma. En los dos
# casos nace una organización: la de quien trabaja solo lleva su nombre (Alcance, glosario).
AccountType = Literal["individual", "firm"]


class RegisterRequest(BaseModel):
    """Datos para crear una cuenta con su organización y la prueba gratis (API-003)."""

    model_config = ConfigDict(extra="forbid")

    account_type: AccountType = Field(
        description="individual si trabaja por su cuenta; firm si abre la cuenta de una oficina."
    )
    full_name: _Name = Field(description="Nombre de la persona.")
    email: _Email = Field(description="Correo de la cuenta; también será el de acceso.")
    password: str = Field(
        description=f"Contraseña de {MIN_LENGTH} a {MAX_LENGTH} caracteres.",
        json_schema_extra={"minLength": MIN_LENGTH, "maxLength": MAX_LENGTH},
    )
    organization_name: _Name | None = Field(
        default=None,
        validate_default=True,
        description="Nombre de la oficina o firma. Solo con account_type firm.",
    )
    legal_version: str = Field(
        max_length=20, description="Versión de los términos y la privacidad que vio la persona."
    )
    accepts_legal_terms: Literal[True] = Field(
        description="Acepta los términos y autoriza el tratamiento de sus datos (CMP-UI-004)."
    )

    @field_validator("organization_name")
    @classmethod
    def _organization_matches_account_type(
        cls, organization_name: str | None, info: ValidationInfo
    ) -> str | None:
        # El error queda en organization_name, el campo que la persona tiene que corregir.
        account_type = info.data.get("account_type")
        if account_type == "firm" and organization_name is None:
            msg = "Falta el nombre de la oficina o firma."
            raise ValueError(msg)
        if account_type == "individual" and organization_name is not None:
            msg = "Una cuenta por cuenta propia no lleva nombre de oficina o firma."
            raise ValueError(msg)
        return organization_name

    @field_validator("password")
    @classmethod
    def _password_length(cls, password: str) -> str:
        # Se mide después de normalizar, igual que se guarda (RN-025).
        if not MIN_LENGTH <= len(normalize(password)) <= MAX_LENGTH:
            msg = f"La contraseña debe tener entre {MIN_LENGTH} y {MAX_LENGTH} caracteres."
            raise ValueError(msg)
        return password


class RegistrationAccepted(BaseModel):
    """La misma respuesta para un correo nuevo y para uno ya registrado (CA-HU-005-03)."""

    detail: str = Field(description="Qué sigue para la persona.")


class ResendVerificationRequest(BaseModel):
    """Correo al que se reenvía el enlace de verificación (UI-007)."""

    model_config = ConfigDict(extra="forbid")

    email: _Email = Field(description="Correo de la cuenta por verificar.")


class VerificationRequested(BaseModel):
    """La misma respuesta exista o no una cuenta por verificar con ese correo."""

    detail: str = Field(description="Qué sigue para la persona.")
