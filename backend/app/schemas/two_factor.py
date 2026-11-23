"""Contrato del segundo factor de autenticación."""

from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.core.passwords import MAX_LENGTH
from app.core.tokens import MAX_TOKEN_LENGTH
from app.schemas.common import Email


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


class RecoveryRequest(BaseModel):
    """Correo de la cuenta que perdió el teléfono y los códigos de respaldo (API-051)."""

    model_config = ConfigDict(extra="forbid")

    email: Email = Field(description="Correo de la cuenta.")


class RecoveryRequested(BaseModel):
    """La misma respuesta exista o no la cuenta, tenga o no segundo factor."""

    detail: str = Field(description="Qué sigue.")


class RecoveryConfirm(BaseModel):
    """Token del enlace del correo y contraseña de la cuenta (API-052)."""

    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=MAX_TOKEN_LENGTH, description="Token del enlace.")
    password: str = Field(
        min_length=1, max_length=4 * MAX_LENGTH, description="Contraseña de la cuenta."
    )


class RecoveryStarted(BaseModel):
    available_at: AwareDatetime = Field(
        description="Primer momento en que se puede terminar la recuperación."
    )


class RecoveryCancel(BaseModel):
    """Token del enlace de cancelación que llega por correo (API-053)."""

    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=MAX_TOKEN_LENGTH, description="Token del enlace.")


class RecoveryComplete(BaseModel):
    """Correo y contraseña de quien termina la recuperación pasada la espera (API-054)."""

    model_config = ConfigDict(extra="forbid")

    email: Email = Field(description="Correo de la cuenta.")
    password: str = Field(
        min_length=1, max_length=4 * MAX_LENGTH, description="Contraseña de la cuenta."
    )
