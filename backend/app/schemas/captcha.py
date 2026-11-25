"""Contrato del reto de la verificación de persona."""

from pydantic import BaseModel, ConfigDict, Field


class CaptchaChallenge(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    algorithm: str = Field(description="Siempre SHA-256.")
    challenge: str = Field(description="SHA-256 en hexadecimal de la sal seguida del número.")
    maxnumber: int = Field(description="El número buscado está entre 0 y este valor.")
    salt: str = Field(description="Sal del reto; incluye su vencimiento.")
    signature: str = Field(description="Firma HMAC del reto; se devuelve tal cual.")
