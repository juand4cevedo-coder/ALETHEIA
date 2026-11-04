"""Esquemas de la cuenta y del acceso."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core.passwords import MAX_LENGTH, MIN_LENGTH, normalize

# Texto visible: sin espacios sobrantes y nunca vacío. Va como alias simple, no con type, para
# que el contrato lo describa en cada campo y no como un esquema aparte.
_Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class RegisterRequest(BaseModel):
    """Datos para crear una cuenta con su organización y la prueba gratis (API-003)."""

    model_config = ConfigDict(extra="forbid")

    full_name: _Name = Field(description="Nombre de la persona.")
    email: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            to_lower=True,
            max_length=254,
            pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        ),
    ] = Field(description="Correo de la cuenta; también será el de acceso.")
    password: str = Field(
        description=f"Contraseña de {MIN_LENGTH} a {MAX_LENGTH} caracteres.",
        json_schema_extra={"minLength": MIN_LENGTH, "maxLength": MAX_LENGTH},
    )
    organization_name: _Name = Field(description="Nombre de la oficina o firma.")
    legal_version: str = Field(
        max_length=20, description="Versión de los términos y la privacidad que vio la persona."
    )
    accepts_legal_terms: Literal[True] = Field(
        description="Acepta los términos y autoriza el tratamiento de sus datos (CMP-UI-004)."
    )

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
