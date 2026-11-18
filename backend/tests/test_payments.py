"""Procesa las notificaciones de Wompi una sola vez, sin fiarse de lo que venga en ellas."""

import datetime
import hashlib
from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, PaymentEvent, Subscription
from app.services import checkout, payments
from tests.organizations import Oficina, crear_oficina

_SECRETO = "test_events_x"
_MENSUAL_ESENCIAL_CENTAVOS = 29_900 * 100


def _credenciales() -> wompi.Credenciales:
    return wompi.Credenciales(
        public_key="pub_test_x",
        private_key="prv_test_x",
        integrity_secret="test_integrity_x",  # noqa: S106
        events_secret=_SECRETO,
        base_url="https://sandbox.wompi.co/v1",
    )


def _webhook(transaction_id: str, status: str, *, checksum_valido: bool = True) -> dict[str, Any]:
    """Un webhook real solo confirma id y estado; nunca lleva la referencia ni el monto que
    este servicio usa para decidir algo (ver el docstring de payments.py)."""
    propiedades = ["transaction.id", "transaction.status"]
    timestamp = 1700000000
    cadena = f"{transaction_id}{status}{timestamp}{_SECRETO}"
    checksum = hashlib.sha256(cadena.encode()).hexdigest() if checksum_valido else "0" * 64
    return {
        "event": "transaction.updated",
        "data": {"transaction": {"id": transaction_id, "status": status}},
        "signature": {"properties": propiedades, "checksum": checksum},
        "timestamp": timestamp,
    }


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


def _consultar_falsa(transaccion: wompi.Transaccion) -> object:
    def consultar(_creds: wompi.Credenciales, _transaction_id: str) -> wompi.Transaccion:
        return transaccion

    return consultar


def test_un_pago_aprobado_activa_la_suscripcion_y_audita(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")
    transaccion = wompi.Transaccion(
        id="tx-1",
        status="APPROVED",
        reference=reference,
        amount_in_cents=_MENSUAL_ESENCIAL_CENTAVOS,
    )
    consultar = _consultar_falsa(transaccion)
    monkeypatch.setattr(wompi, "consultar_transaccion", consultar)

    payments.procesar_evento(db, _webhook("tx-1", "APPROVED"), _credenciales())

    db.refresh(subscription)
    assert subscription.status == "active"
    assert subscription.billing_cycle == "monthly"
    assert subscription.access_source == "payment"
    assert subscription.current_period_end is not None
    assert subscription.pending_checkout_reference is None
    assert (
        db.scalar(
            select(func.count()).select_from(AuditLog).where(AuditLog.action == "payment_approved")
        )
        == 1
    )


def test_un_pago_rechazado_no_activa_nada(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")
    transaccion = wompi.Transaccion(
        id="tx-1",
        status="DECLINED",
        reference=reference,
        amount_in_cents=_MENSUAL_ESENCIAL_CENTAVOS,
    )
    consultar = _consultar_falsa(transaccion)
    monkeypatch.setattr(wompi, "consultar_transaccion", consultar)

    payments.procesar_evento(db, _webhook("tx-1", "DECLINED"), _credenciales())

    db.refresh(subscription)
    assert subscription.status == "trial"
    assert (
        db.scalar(
            select(func.count()).select_from(AuditLog).where(AuditLog.action == "payment_declined")
        )
        == 1
    )


def test_un_monto_distinto_al_del_plan_no_activa_nada(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")
    # Wompi dice APPROVED, pero por un centavo menos del precio del plan: no se activa.
    transaccion = wompi.Transaccion(
        id="tx-1",
        status="APPROVED",
        reference=reference,
        amount_in_cents=_MENSUAL_ESENCIAL_CENTAVOS - 1,
    )
    consultar = _consultar_falsa(transaccion)
    monkeypatch.setattr(wompi, "consultar_transaccion", consultar)

    payments.procesar_evento(db, _webhook("tx-1", "APPROVED"), _credenciales())

    db.refresh(subscription)
    assert subscription.status == "trial"
    assert (
        db.scalar(
            select(func.count()).select_from(AuditLog).where(AuditLog.action == "payment_declined")
        )
        == 1
    )


def test_una_firma_invalida_no_consulta_a_wompi_ni_activa_nada(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office)

    def no_deberia_llamarse(_creds: wompi.Credenciales, _transaction_id: str) -> wompi.Transaccion:
        pytest.fail("Una notificación con firma inválida no debe consultar la transacción.")

    monkeypatch.setattr(wompi, "consultar_transaccion", no_deberia_llamarse)

    payments.procesar_evento(
        db, _webhook("tx-1", "APPROVED", checksum_valido=False), _credenciales()
    )

    db.refresh(subscription)
    assert subscription.status == "trial"
    guardado = db.scalars(select(PaymentEvent).where(PaymentEvent.gateway == "wompi")).one()
    assert guardado.signature_valid is False


def test_una_firma_invalida_nunca_bloquea_la_clave_de_la_real(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La reserva P1: una notificación falsa no puede impedir que la real, llegada después,
    sí active el plan."""
    office = crear_oficina(db)
    subscription = _en_prueba(db, office)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")
    transaccion = wompi.Transaccion(
        id="tx-1",
        status="APPROVED",
        reference=reference,
        amount_in_cents=_MENSUAL_ESENCIAL_CENTAVOS,
    )
    consultar = _consultar_falsa(transaccion)
    monkeypatch.setattr(wompi, "consultar_transaccion", lambda *a: None)
    payments.procesar_evento(
        db, _webhook("tx-1", "APPROVED", checksum_valido=False), _credenciales()
    )
    monkeypatch.setattr(wompi, "consultar_transaccion", consultar)

    payments.procesar_evento(db, _webhook("tx-1", "APPROVED"), _credenciales())

    db.refresh(subscription)
    assert subscription.status == "active"
    assert (
        db.scalar(
            select(func.count()).select_from(PaymentEvent).where(PaymentEvent.gateway == "wompi")
        )
        == 2
    )


def test_el_mismo_evento_repetido_no_se_procesa_dos_veces(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")
    transaccion = wompi.Transaccion(
        id="tx-1",
        status="APPROVED",
        reference=reference,
        amount_in_cents=_MENSUAL_ESENCIAL_CENTAVOS,
    )
    consultar = _consultar_falsa(transaccion)
    monkeypatch.setattr(wompi, "consultar_transaccion", consultar)
    evento = _webhook("tx-1", "APPROVED")

    payments.procesar_evento(db, evento, _credenciales())
    db.refresh(subscription)
    subscription.status = "canceled"  # si se reprocesa, esto se vería sobrescrito
    db.flush()

    payments.procesar_evento(db, evento, _credenciales())

    db.refresh(subscription)
    assert subscription.status == "canceled"
    assert (
        db.scalar(
            select(func.count()).select_from(PaymentEvent).where(PaymentEvent.gateway == "wompi")
        )
        == 1
    )


def test_una_referencia_que_no_es_nuestra_se_ignora(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    transaccion = wompi.Transaccion(
        id="tx-1",
        status="APPROVED",
        reference="otra-integracion-cualquiera",
        amount_in_cents=1,
    )
    consultar = _consultar_falsa(transaccion)
    monkeypatch.setattr(wompi, "consultar_transaccion", consultar)

    payments.procesar_evento(db, _webhook("tx-1", "APPROVED"), _credenciales())

    # No debe lanzar ni dejar nada activado; solo queda el PaymentEvent guardado.
    guardado = db.scalars(select(PaymentEvent).where(PaymentEvent.gateway == "wompi")).one()
    assert guardado.signature_valid is True


def test_un_estado_pendiente_no_genera_evento_ni_consulta_a_wompi(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def no_deberia_llamarse(_creds: wompi.Credenciales, _transaction_id: str) -> wompi.Transaccion:
        pytest.fail("Un estado PENDING no se consulta: Wompi no lo notifica por webhook.")

    monkeypatch.setattr(wompi, "consultar_transaccion", no_deberia_llamarse)

    payments.procesar_evento(db, _webhook("tx-1", "PENDING"), _credenciales())

    assert db.scalar(select(func.count()).select_from(PaymentEvent)) == 0
