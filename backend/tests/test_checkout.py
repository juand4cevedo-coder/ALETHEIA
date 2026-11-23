"""Primer cobro de una suscripción con Wompi (HU-027): quién puede iniciarlo y con qué datos."""

import datetime
import hashlib
import urllib.parse
import uuid

import pytest
from pydantic import Secret
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.core.config import Settings
from app.core.legal import LEGAL_VERSION
from app.db.tenancy import TenantContext, set_tenant
from app.models import Job, Subscription
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
    subscription.trial_ends_at = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=7)
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
    tarea = db.scalars(select(Job).where(Job.kind == "payment_reconcile")).one()
    assert tarea.payload["transaction_id"] == "tx-1"


def _con_wompi(settings: Settings) -> Settings:
    return settings.model_copy(
        update={
            "wompi_public_key": "pub_test_x",
            "wompi_private_key": Secret("prv_test_x"),
            "wompi_integrity_secret": Secret("test_integrity_x"),
            "wompi_events_secret": Secret("test_events_x"),
        }
    )


def test_la_direccion_del_checkout_web_lleva_la_firma_de_integridad_con_el_vencimiento() -> None:
    creds = wompi.Credenciales(
        public_key="pub_test_x",
        private_key="prv_test_x",
        integrity_secret="test_integrity_x",  # noqa: S106
        events_secret="test_events_x",  # noqa: S106
        base_url="https://sandbox.wompi.co/v1",
    )
    ahora = datetime.datetime(2026, 11, 24, 15, 0, tzinfo=datetime.UTC)

    url, vence = wompi.url_de_checkout_web(
        creds,
        reference="ref-1",
        amount_in_cents=2_990_000,
        redirect_url="https://aletheia.sbs/app/cuenta",
        customer_email="ana@example.com",
        vigencia=datetime.timedelta(hours=1),
        ahora=ahora,
    )

    assert url.startswith("https://checkout.wompi.co/p/?")
    consulta = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    assert consulta["public-key"] == ["pub_test_x"]
    assert consulta["currency"] == ["COP"]
    assert consulta["amount-in-cents"] == ["2990000"]
    assert consulta["redirect-url"] == ["https://aletheia.sbs/app/cuenta"]
    assert consulta["expiration-time"] == ["2026-11-24T16:00:00.000Z"]
    assert vence == ahora + datetime.timedelta(hours=1)
    esperada = hashlib.sha256(
        b"ref-12990000COP2026-11-24T16:00:00.000Ztest_integrity_x"
    ).hexdigest()
    assert consulta["signature:integrity"] == [esperada]
    # La llave privada y el secreto de eventos nunca salen en la dirección.
    assert "prv_test_x" not in url
    assert "test_events_x" not in url


def test_el_checkout_web_se_inicia_con_una_referencia_nueva_y_bloquea_un_segundo_cobro(
    db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)
    principal = _principal(office.organization_id, office.owner.id, "owner")

    url = checkout.iniciar_checkout_web(db, _con_wompi(settings), principal, "essential", "monthly")

    consulta = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    assert consulta["amount-in-cents"] == [str(29_900 * 100)]
    subscription = db.scalars(
        select(Subscription).where(Subscription.organization_id == office.organization_id)
    ).one()
    assert subscription.pending_checkout_reference == consulta["reference"][0]
    referencia = checkout.leer_referencia(consulta["reference"][0])
    assert referencia is not None
    assert referencia.organization_id == office.organization_id
    with pytest.raises(checkout.CheckoutNoPermitidoError):
        checkout.iniciar_checkout_web(db, _con_wompi(settings), principal, "essential", "monthly")


def test_un_cobro_que_nunca_se_pago_deja_de_bloquear_pasada_su_vigencia(
    db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office)
    principal = _principal(office.organization_id, office.owner.id, "owner")
    vieja = uuid.UUID(
        bytes=(
            int(
                (datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=2)).timestamp()
                * 1000
            )
        ).to_bytes(6, "big")
        + b"\x70\x00\x80\x00\x00\x00\x00\x00\x00\x01"
    )
    subscription.pending_checkout_reference = (
        f"aletheia:{office.organization_id}:essential:monthly:{vieja}"
    )
    db.flush()

    anterior = subscription.pending_checkout_reference

    url = checkout.iniciar_checkout_web(db, _con_wompi(settings), principal, "essential", "monthly")

    consulta = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    assert consulta["reference"][0] != anterior
    assert subscription.pending_checkout_reference == consulta["reference"][0]


def test_solo_quien_administra_la_facturacion_inicia_el_checkout_web(
    db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)
    principal = _principal(office.organization_id, office.owner.id, "lawyer")

    with pytest.raises(checkout.CheckoutNoPermitidoError):
        checkout.iniciar_checkout_web(db, _con_wompi(settings), principal, "essential", "monthly")


def test_al_volver_del_checkout_web_se_confirma_con_wompi_y_solo_la_transaccion_propia(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office)
    principal = _principal(office.organization_id, office.owner.id, "owner")
    con_wompi = _con_wompi(settings)
    url = checkout.iniciar_checkout_web(db, con_wompi, principal, "essential", "monthly")
    reference = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["reference"][0]
    transacciones = {
        "tx-propia": wompi.Transaccion("tx-propia", "APPROVED", reference, 29_900 * 100),
        "tx-ajena": wompi.Transaccion(
            "tx-ajena",
            "APPROVED",
            checkout.referencia_nueva(uuid.uuid7(), "essential", "monthly"),
            29_900 * 100,
        ),
    }
    monkeypatch.setattr(
        wompi, "consultar_transaccion", lambda _creds, identificador: transacciones[identificador]
    )

    with pytest.raises(checkout.TransaccionAjenaError):
        checkout.confirmar_regreso(db, con_wompi, principal, "tx-ajena")
    assert subscription.status == "trial"

    estado = checkout.confirmar_regreso(db, con_wompi, principal, "tx-propia")

    assert estado == "APPROVED"
    db.refresh(subscription)
    assert subscription.status == "active"
    assert subscription.billing_cycle == "monthly"
    assert subscription.pending_checkout_reference is None


@pytest.mark.parametrize(
    "identificador",
    ["../merchants/info", "tx/1", "tx?x=1", "tx#a", "", "a" * 101, "tx 1", "https://evil.test"],
)
def test_un_identificador_que_no_es_de_wompi_nunca_llega_a_la_url(
    identificador: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    llamadas: list[str] = []
    monkeypatch.setattr(wompi, "_llamar", lambda url, **_kw: llamadas.append(url) or {})
    creds = wompi.Credenciales(
        public_key="pub_test_x",
        private_key="prv_test_x",
        integrity_secret="test_integrity_x",  # noqa: S106
        events_secret="test_events_x",  # noqa: S106
        base_url="https://sandbox.wompi.co/v1",
    )

    with pytest.raises(wompi.WompiRechazadoError):
        wompi.consultar_transaccion(creds, identificador)

    assert llamadas == []
