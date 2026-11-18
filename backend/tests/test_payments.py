"""Procesa las notificaciones de Wompi una sola vez y activa el plan si el pago se aprueba."""

import hashlib
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, PaymentEvent, Subscription
from app.services import checkout, payments
from tests.organizations import crear_oficina

_SECRETO = "test_events_x"


def _evento(*, reference: str, status: str, transaction_id: str | None = None) -> dict[str, Any]:
    transaction_id = transaction_id or f"tx-{uuid.uuid4().hex[:8]}"
    propiedades = ["transaction.id", "transaction.status", "transaction.reference"]
    timestamp = 1700000000
    cadena = f"{transaction_id}{status}{reference}{timestamp}{_SECRETO}"
    checksum = hashlib.sha256(cadena.encode()).hexdigest()
    return {
        "event": "transaction.updated",
        "data": {
            "transaction": {
                "id": transaction_id,
                "status": status,
                "reference": reference,
            }
        },
        "signature": {"properties": propiedades, "checksum": checksum},
        "timestamp": timestamp,
    }


def _en_prueba(db: Session, organization_id: uuid.UUID) -> Subscription:
    subscription = db.scalars(
        select(Subscription).where(Subscription.organization_id == organization_id)
    ).one()
    subscription.status = "trial"
    subscription.billing_cycle = "none"
    db.flush()
    return subscription


def test_un_pago_aprobado_activa_la_suscripcion_y_audita(db: Session) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office.organization_id)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")

    payments.procesar_evento(db, _evento(reference=reference, status="APPROVED"), _SECRETO)

    db.refresh(subscription)
    assert subscription.status == "active"
    assert subscription.billing_cycle == "monthly"
    assert subscription.access_source == "payment"
    assert subscription.current_period_end is not None
    assert (
        db.scalar(
            select(func.count()).select_from(AuditLog).where(AuditLog.action == "payment_approved")
        )
        == 1
    )


def test_un_pago_rechazado_no_activa_nada(db: Session) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office.organization_id)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")

    payments.procesar_evento(db, _evento(reference=reference, status="DECLINED"), _SECRETO)

    db.refresh(subscription)
    assert subscription.status == "trial"
    assert (
        db.scalar(
            select(func.count()).select_from(AuditLog).where(AuditLog.action == "payment_declined")
        )
        == 1
    )


def test_una_firma_invalida_no_activa_nada_pero_se_guarda(db: Session) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office.organization_id)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")
    evento = _evento(reference=reference, status="APPROVED")
    evento["signature"]["checksum"] = "0" * 64

    payments.procesar_evento(db, evento, _SECRETO)

    db.refresh(subscription)
    assert subscription.status == "trial"
    guardado = db.scalars(select(PaymentEvent).where(PaymentEvent.gateway == "wompi")).one()
    assert guardado.signature_valid is False


def test_el_mismo_evento_repetido_no_se_procesa_dos_veces(db: Session) -> None:
    office = crear_oficina(db)
    subscription = _en_prueba(db, office.organization_id)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")
    evento = _evento(reference=reference, status="APPROVED")

    payments.procesar_evento(db, evento, _SECRETO)
    db.refresh(subscription)
    subscription.status = "canceled"  # si se reprocesa, esto se vería sobrescrito
    db.flush()

    payments.procesar_evento(db, evento, _SECRETO)

    db.refresh(subscription)
    assert subscription.status == "canceled"
    assert (
        db.scalar(
            select(func.count()).select_from(PaymentEvent).where(PaymentEvent.gateway == "wompi")
        )
        == 1
    )


def test_una_referencia_que_no_es_nuestra_se_ignora(db: Session) -> None:
    payments.procesar_evento(
        db, _evento(reference="otra-integracion-cualquiera", status="APPROVED"), _SECRETO
    )
    # No debe lanzar ni dejar nada activado; solo queda el PaymentEvent guardado.
    guardado = db.scalars(select(PaymentEvent).where(PaymentEvent.gateway == "wompi")).one()
    assert guardado.signature_valid is True


def test_un_estado_pendiente_no_genera_evento(db: Session) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office.organization_id)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")

    payments.procesar_evento(db, _evento(reference=reference, status="PENDING"), _SECRETO)

    assert db.scalar(select(func.count()).select_from(PaymentEvent)) == 0
