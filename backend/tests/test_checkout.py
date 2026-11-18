"""Primer cobro de una suscripción con Wompi (HU-027): quién puede iniciarlo y con qué datos."""

import uuid

import pytest
from pydantic import Secret
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.core.config import Settings
from app.core.legal import LEGAL_VERSION
from app.db.tenancy import TenantContext, set_tenant
from app.models import Subscription
from app.services import checkout
from app.services.sessions import Principal
from tests.organizations import Oficina, crear_oficina


def _principal(organization_id: uuid.UUID, user_id: uuid.UUID, role: str | None) -> Principal:
    return Principal(
        user_id=user_id,
        session_id=uuid.uuid7(),
        organization_id=organization_id,
        role=role,
        legal_version=LEGAL_VERSION,
    )


def _en_prueba(db: Session, office: Oficina) -> Subscription:
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = db.scalars(
        select(Subscription).where(Subscription.organization_id == office.organization_id)
    ).one()
    subscription.status = "trial"
    subscription.billing_cycle = "none"
    db.flush()
    return subscription


def test_referencia_redondea_sin_perder_datos() -> None:
    organization_id = uuid.uuid7()
    reference = checkout.referencia_nueva(organization_id, "essential", "monthly")

    leida = checkout.leer_referencia(reference)

    assert leida is not None
    assert leida.organization_id == organization_id
    assert leida.plan_code == "essential"
    assert leida.billing_cycle == "monthly"


def test_una_referencia_ajena_no_se_interpreta() -> None:
    assert checkout.leer_referencia("otra-integracion-12345") is None


def test_solo_el_propietario_puede_iniciar_el_cobro(db: Session, settings: Settings) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)
    principal = _principal(office.organization_id, office.owner.id, "lawyer")

    with pytest.raises(checkout.CheckoutNoPermitidoError):
        checkout.iniciar(db, settings, principal, "essential", "monthly", "3001234567", "a", "p")


def test_un_telefono_que_no_es_celular_colombiano_se_rechaza(
    db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)
    principal = _principal(office.organization_id, office.owner.id, "owner")

    with pytest.raises(checkout.CheckoutNoPermitidoError):
        checkout.iniciar(db, settings, principal, "essential", "monthly", "123", "a", "p")


def test_una_suscripcion_ya_pagada_no_se_vuelve_a_cobrar(db: Session, settings: Settings) -> None:
    office = crear_oficina(db)  # crear_oficina ya deja un plan activo y pagado
    principal = _principal(office.organization_id, office.owner.id, "owner")

    with pytest.raises(checkout.CheckoutNoPermitidoError):
        checkout.iniciar(db, settings, principal, "essential", "monthly", "3001234567", "a", "p")


def test_un_segundo_cobro_no_arranca_mientras_el_primero_esta_pendiente(
    db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office)
    subscription.pending_checkout_reference = checkout.referencia_nueva(
        office.organization_id, "essential", "monthly"
    )
    db.flush()
    principal = _principal(office.organization_id, office.owner.id, "owner")

    with pytest.raises(checkout.CheckoutNoPermitidoError):
        checkout.iniciar(db, settings, principal, "essential", "monthly", "3001234567", "a", "p")


def test_el_cobro_se_crea_con_los_tokens_y_la_firma_de_wompi(
    db: Session, monkeypatch: pytest.MonkeyPatch, settings: Settings
) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)
    principal = _principal(office.organization_id, office.owner.id, "owner")
    con_wompi = settings.model_copy(
        update={
            "wompi_public_key": "pub_test_x",
            "wompi_private_key": Secret("prv_test_x"),
            "wompi_integrity_secret": Secret("test_integrity_x"),
            "wompi_events_secret": Secret("test_events_x"),
        }
    )
    llamadas: dict[str, object] = {}

    def crear_falsa(_creds: wompi.Credenciales, **kwargs: object) -> wompi.Transaccion:
        llamadas.update(kwargs)
        return wompi.Transaccion(
            id="tx-1",
            status="PENDING",
            reference=str(kwargs["reference"]),
            amount_in_cents=int(kwargs["amount_in_cents"]),  # type: ignore[call-overload]
        )

    monkeypatch.setattr(wompi, "crear_transaccion_nequi", crear_falsa)

    cobro = checkout.iniciar(
        db, con_wompi, principal, "essential", "monthly", "3001234567", "acc", "pers"
    )

    assert cobro.status == "PENDING"
    assert cobro.transaction_id == "tx-1"
    assert llamadas["phone_number"] == "3001234567"
    assert llamadas["amount_in_cents"] == 29_900 * 100
    assert llamadas["acceptance_token"] == "acc"  # noqa: S105
    assert llamadas["accept_personal_auth"] == "pers"
    referencia = checkout.leer_referencia(cobro.reference)
    assert referencia is not None
    assert referencia.organization_id == office.organization_id
    assert referencia.plan_code == "essential"
    subscription = db.scalars(
        select(Subscription).where(Subscription.organization_id == office.organization_id)
    ).one()
    assert subscription.pending_checkout_reference == cobro.reference
