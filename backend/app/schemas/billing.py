"""Contrato del primer cobro de una suscripción con Wompi (HU-027)."""

import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class WompiTermsOut(BaseModel):
    """Los dos contratos que Wompi exige aceptar; el cliente debe mostrarlos y solo mandar
    los tokens de vuelta en /billing/checkout si la persona los aceptó de verdad (RN-022)."""

    acceptance_token: str = Field(description="Token de aceptación de las políticas de Wompi.")
    acceptance_permalink: str = Field(description="Texto de las políticas que ampara el token.")
    accept_personal_auth: str = Field(
        description="Token de autorización de tratamiento de datos personales."
    )
    personal_auth_permalink: str = Field(
        description="Texto de la autorización que ampara el token."
    )


class CheckoutCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_code: str = Field(pattern=r"^[a-z_]{1,30}$")
    billing_cycle: Literal["monthly", "annual"]
    # Celular colombiano registrado en Nequi: empieza en 3 y tiene 10 dígitos.
    phone_number: str = Field(pattern=r"^3\d{9}$")
    # Los mismos dos tokens que entregó GET /billing/wompi-terms, después de que la persona
    # vio los contratos y los aceptó. El backend nunca los pide por su cuenta: solo así se
    # sabe que alguien los aceptó de verdad y no que el servidor aceptó en su nombre.
    acceptance_token: str = Field(min_length=1, max_length=2000)
    accept_personal_auth: str = Field(min_length=1, max_length=2000)


class CheckoutOut(BaseModel):
    transaction_id: str
    reference: str
    status: Literal["PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"]


class CheckoutWebCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_code: str = Field(pattern=r"^[a-z_]{1,30}$")
    billing_cycle: Literal["monthly", "annual"]


class CheckoutWebOut(BaseModel):
    checkout_url: str = Field(
        description="Página de Wompi donde la persona paga con tarjeta, PSE, Nequi u otros medios."
    )


class ReceiptOut(BaseModel):
    """Un comprobante de pago de ALETHEIA."""

    id: uuid.UUID
    number: str = Field(description="Número del comprobante, por ejemplo CP-2026-000001.")
    issued_at: datetime.datetime
    plan_name: str
    billing_cycle: Literal["monthly", "annual"]
    amount_cop: int
    payment_method: str | None = Field(description="Medio con que se pagó, como lo informó Wompi.")
    period_start: datetime.datetime
    period_end: datetime.datetime
    transaction_id: str = Field(description="Identificador de la transacción en Wompi.")


class CheckoutWebResult(BaseModel):
    status: Literal["PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"]
