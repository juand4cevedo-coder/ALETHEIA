"""Contrato del segundo factor de autenticación."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TwoFactorStatus(BaseModel):
    enabled: bool
    recovery_codes_remaining: int = Field(
        description="Códigos de respaldo que todavía no se han usado."
    )


class TwoFactorSetup(BaseModel):
    """Lo que necesita la aplicación de autenticación: el secreto y el enlace otpauth."""

    secret: str = Field(description="Secreto en base32, para escribirlo a mano.")
    uri: str = Field(description="Enlace otpauth:// que una aplicación de autenticación abre.")


class TwoFactorCode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(
        min_length=6,
        max_length=32,
        description="Código de 6 dígitos de la aplicación o un código de respaldo.",
    )


class TwoFactorEnabled(BaseModel):
    recovery_codes: list[str] = Field(
        description="Códigos de respaldo de un solo uso. Se muestran esta única vez."
    )


class LoginChallenge(BaseModel):
    """El ingreso necesita el segundo paso: llega la cookie del desafío."""

    two_factor_required: Literal[True] = True
