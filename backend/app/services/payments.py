"""Procesa las notificaciones de Wompi y activa la suscripción (HU-027, DAT-10).

Un webhook solo avisa que algo cambió; nunca se usan sus datos para decidir qué activar.
Wompi firma `transaction.id`, `transaction.status` y `transaction.amount_in_cents` (las
propiedades que la propia notificación declara en signature.properties), pero no firma
`reference`: alguien con una notificación válida ya entregada podría reenviarla con la
referencia cambiada para activar el plan de otra organización. Por eso, una vez que la firma
verifica, se vuelve a pedir la transacción completa con GET /transactions/{id} (firmado con
la llave privada, no con nada que llegó en la petición pública) y solo esa respuesta decide
la referencia, el estado y el monto que se aplican.

Cada notificación con firma válida se guarda una sola vez (índice único en gateway +
gateway_event_id, por transacción y estado): un reintento de Wompi por no haber recibido 200
no activa nada dos veces. Una notificación con firma inválida se guarda aparte, con una clave
que nunca choca con la de una válida futura para la misma transacción: si chocara, cualquiera
que mandara una firma inválida primero podría bloquear para siempre la activación real
(RN-018).
"""

import datetime
import uuid
from typing import Any, Final

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Organization, PaymentEvent, Plan, Subscription
from app.services import subscription_expiration
from app.services.checkout import Referencia, leer_referencia

_DURACION: Final = {"monthly": relativedelta(months=1), "annual": relativedelta(years=1)}
# Solo los estados finales de una transacción generan un evento que procesamos; PENDING no
# se notifica por webhook según la guía de Payment Methods.
_ESTADOS_FINALES: Final = frozenset({"APPROVED", "DECLINED", "VOIDED", "ERROR"})


def procesar_evento(session: Session, payload: dict[str, Any], creds: wompi.Credenciales) -> None:
    datos = payload.get("data")
    transaccion_webhook = datos.get("transaction") if isinstance(datos, dict) else None
    if not isinstance(transaccion_webhook, dict):
        return  # otro tipo de evento (p. ej. nequi_token.updated): no lo procesamos todavía
    transaction_id = str(transaccion_webhook.get("id", ""))
    estado_anunciado = str(transaccion_webhook.get("status", ""))
    if not transaction_id or estado_anunciado not in _ESTADOS_FINALES:
        return
    valida = wompi.firma_de_webhook_es_valida(payload, creds.events_secret)

    if not valida:
        # Clave única propia, para que nunca reserve la que usará la notificación real.
        session.execute(
            insert(PaymentEvent).values(
                gateway="wompi",
                gateway_event_id=f"{transaction_id}:{estado_anunciado}:invalida:{uuid.uuid7()}",
                event_type=str(payload.get("event", "transaction.updated"))[:60],
                signature_valid=False,
                payload={"status": estado_anunciado},
            )
        )
        return

    # A partir de aquí nada del payload público decide nada: se vuelve a pedir la transacción
    # con la llave privada y solo esa respuesta se usa.
    transaccion = wompi.consultar_transaccion(creds, transaction_id)
    if transaccion.status not in _ESTADOS_FINALES:
        return
    _registrar_y_aplicar(session, transaccion, str(payload.get("event", "transaction.updated")))


def reconciliar(session: Session, creds: wompi.Credenciales, transaction_id: str) -> None:
    """Red de seguridad para un webhook que nunca llegó (EVT-007): vuelve a pedir la misma
    transacción y la aplica por el mismo camino que un webhook válido, con la misma clave de
    deduplicación. Si el webhook sí llegó, esto encuentra la fila que ya existe y no hace nada;
    si no llegó, activa o rechaza el plan con la respuesta de Wompi, nunca con una suposición."""
    transaccion = wompi.consultar_transaccion(creds, transaction_id)
    if transaccion.status not in _ESTADOS_FINALES:
        return  # sigue pendiente: el checkout todavía puede recibir el webhook más tarde
    _registrar_y_aplicar(session, transaccion, "reconcile")


def _registrar_y_aplicar(session: Session, transaccion: wompi.Transaccion, event_type: str) -> None:
    resultado = session.execute(
        insert(PaymentEvent)
        .values(
            gateway="wompi",
            gateway_event_id=f"{transaccion.id}:{transaccion.status}"[:100],
            event_type=event_type[:60],
            signature_valid=True,
            payload={
                "status": transaccion.status,
                "reference": transaccion.reference,
                "amount_in_cents": transaccion.amount_in_cents,
            },
        )
        .on_conflict_do_nothing(index_elements=["gateway", "gateway_event_id"])
        .returning(PaymentEvent.id)
    )
    event_id = resultado.scalar_one_or_none()
    if event_id is None:
        return  # ya se procesó esta transacción con este estado
    referencia = leer_referencia(transaccion.reference)
    if referencia is None:
        return
    _aplicar(session, referencia, transaccion, event_id)


def _aplicar(
    session: Session, referencia: Referencia, transaccion: wompi.Transaccion, event_id: Any
) -> None:
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
    # Esta transacción ya llegó a un estado final: deja de bloquear un cobro nuevo. Si para
    # entonces ya hay otra referencia pendiente (un cobro posterior), esa no se toca.
    if subscription.pending_checkout_reference == transaccion.reference:
        subscription.pending_checkout_reference = None

    esperado = (
        plan.monthly_price_cop if referencia.billing_cycle == "monthly" else plan.annual_price_cop
    )
    if transaccion.status == "APPROVED" and (
        esperado is None or transaccion.amount_in_cents != esperado * 100
    ):
        # El monto que de verdad cobró Wompi no es el del plan que pide la referencia: no se
        # activa nada con un cobro que no corresponde (RN-032).
        action = "payment_declined"
    elif transaccion.status == "APPROVED":
        subscription.plan_id = plan.id
        subscription.status = "active"
        subscription.billing_cycle = referencia.billing_cycle
        subscription.access_source = "payment"
        subscription.current_period_end = now + _DURACION[referencia.billing_cycle]
        subscription.read_only_until = None
        if organization.status == "read_only":
            organization.status = "active"
        subscription_expiration.schedule(
            session, referencia.organization_id, subscription.current_period_end
        )
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
