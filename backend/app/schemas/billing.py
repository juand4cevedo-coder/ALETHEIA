"""Contrato del primer cobro de una suscripción con Wompi (HU-027)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CheckoutCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_code: str = Field(pattern=r"^[a-z_]{1,30}$")
    billing_cycle: Literal["monthly", "annual"]
    # Celular colombiano registrado en Nequi: empieza en 3 y tiene 10 dígitos.
    phone_number: str = Field(pattern=r"^3\d{9}$")


class CheckoutOut(BaseModel):
    transaction_id: str
    reference: str
    status: Literal["PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"]
