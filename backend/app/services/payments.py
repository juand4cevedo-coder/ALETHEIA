"""Procesa las notificaciones de Wompi y activa la suscripción (HU-027, DAT-10).

Cada notificación se guarda una sola vez (índice único en gateway + gateway_event_id): un
reintento de Wompi por no haber recibido 200 no activa nada dos veces. Solo una notificación
con firma válida puede activar o rechazar un plan; una inválida queda guardada para auditoría,
pero nunca se usa (RN-018).
"""

import datetime
from typing import Any, Final

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Organization, PaymentEvent, Plan, Subscription
from app.services.checkout import Referencia, leer_referencia

_DURACION: Final = {"monthly": relativedelta(months=1), "annual": relativedelta(years=1)}
# Solo los estados finales de una transacción generan un evento que procesamos; PENDING no
# se notifica por webhook según la guía de Payment Methods.
_ESTADOS_FINALES: Final = frozenset({"APPROVED", "DECLINED", "VOIDED", "ERROR"})


def procesar_evento(session: Session, payload: dict[str, Any], events_secret: str) -> None:
    datos = payload.get("data")
    transaccion = datos.get("transaction") if isinstance(datos, dict) else None
    if not isinstance(transaccion, dict):
        return  # otro tipo de evento (p. ej. nequi_token.updated): no lo procesamos todavía
    status = str(transaccion.get("status", ""))
    transaction_id = str(transaccion.get("id", ""))
    reference = str(transaccion.get("reference", ""))
    if not transaction_id or status not in _ESTADOS_FINALES:
        return
    valida = wompi.firma_de_webhook_es_valida(payload, events_secret)

    resultado = session.execute(
        insert(PaymentEvent)
        .values(
            gateway="wompi",
            # Dedup por transacción y estado: un reintento del mismo estado no se repite, pero
            # una transacción que pasa por dos estados finales distintos sí se registra aparte.
            gateway_event_id=f"{transaction_id}:{status}"[:100],
            event_type=str(payload.get("event", "transaction.updated"))[:60],
            signature_valid=valida,
            payload={"status": status, "reference": reference},
        )
        .on_conflict_do_nothing(index_elements=["gateway", "gateway_event_id"])
        .returning(PaymentEvent.id)
    )
    event_id = resultado.scalar_one_or_none()
    if event_id is None or not valida:
        return  # ya se procesó antes, o la firma no cuadra: nunca activa nada
    referencia = leer_referencia(reference)
    if referencia is None:
        return
    _aplicar(session, referencia, status, event_id)


def _aplicar(session: Session, referencia: Referencia, status: str, event_id: Any) -> None:
    set_tenant(session, TenantContext(organization_id=referencia.organization_id))
    organization = session.scalar(
        select(Organization).where(Organization.id == referencia.organization_id).with_for_update()
    )
    subscription = session.scalar(
        select(Subscription)
        .where(Subscription.organization_id == referencia.organization_id)
        .with_for_update()
    )
    plan = session.scalar(select(Plan).where(Plan.code == referencia.plan_code))
    if organization is None or subscription is None or plan is None:
        return
    now = datetime.datetime.now(datetime.UTC)
    event = session.get(PaymentEvent, event_id)
    if event is not None:
        event.processed_at = now

    if status == "APPROVED":
        subscription.plan_id = plan.id
        subscription.status = "active"
        subscription.billing_cycle = referencia.billing_cycle
        subscription.access_source = "payment"
        subscription.current_period_end = now + _DURACION[referencia.billing_cycle]
        subscription.read_only_until = None
        if organization.status == "read_only":
            organization.status = "active"
        action = "payment_approved"
    else:
        action = "payment_declined"
    session.add(
        AuditLog(
            organization_id=referencia.organization_id,
            actor_user_id=None,
            action=action,
            target_id=subscription.id,
            ip=None,
            user_agent=None,
            created_at=now,
        )
    )
