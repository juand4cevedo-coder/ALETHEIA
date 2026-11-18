"""Primer cobro de una suscripción con Wompi, por Nequi (HU-027), y su webhook."""

import logging
from typing import Annotated, Any, Final, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.api.deps import get_app_settings, get_principal, get_session
from app.core.config import Settings
from app.schemas.billing import CheckoutCreate, CheckoutOut
from app.services import checkout as checkout_service
from app.services import payments as payments_service
from app.services.sessions import Principal

router = APIRouter(tags=["facturación"])
logger = logging.getLogger(__name__)

_NO_STORE = {"Cache-Control": "no-store"}
_ESTADOS: Final = frozenset({"PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"})


@router.post(
    "/billing/checkout",
    summary="Iniciar el primer cobro de una suscripción con Nequi",
    responses={
        status.HTTP_403_FORBIDDEN: {"description": "El rol no administra la facturación."},
        status.HTTP_422_UNPROCESSABLE_ENTITY: {
            "description": "El plan, el ciclo o el teléfono no son válidos."
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Wompi no respondió."},
    },
)
def create_checkout(
    body: CheckoutCreate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> CheckoutOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        cobro = checkout_service.iniciar(
            session, settings, principal, body.plan_code, body.billing_cycle, body.phone_number
        )
        session.commit()
    except checkout_service.CheckoutNoPermitidoError:
        session.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se pudo iniciar el cobro con esos datos.",
            headers=_NO_STORE,
        ) from None
    except wompi.WompiNoConfiguradoError:
        session.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La pasarela de pagos no está disponible.",
            headers=_NO_STORE,
        ) from None
    except wompi.WompiRechazadoError as exc:
        session.rollback()
        logger.warning("Wompi rechazó la solicitud de cobro: %s", exc)
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Wompi no aceptó la solicitud de cobro.",
            headers=_NO_STORE,
        ) from None
    except wompi.WompiNoDisponibleError:
        session.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Wompi no respondió; inténtelo de nuevo en un momento.",
            headers=_NO_STORE,
        ) from None
    if cobro.status not in _ESTADOS:
        logger.error("Wompi devolvió un estado de transacción desconocido: %s", cobro.status)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, headers=_NO_STORE)
    return CheckoutOut(
        transaction_id=cobro.transaction_id,
        reference=cobro.reference,
        status=cast(Literal["PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"], cobro.status),
    )


@router.post(
    "/webhooks/wompi",
    summary="Notificación de Wompi sobre una transacción",
    include_in_schema=False,
)
async def wompi_webhook(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> Response:
    # Wompi reintenta hasta tres veces en 24 horas si no recibe 200; el cuerpo no importa
    # (guía de Events). Un cuerpo que no es JSON se ignora con 200, para no gastar reintentos
    # en algo que nunca va a procesarse.
    try:
        payload: dict[str, Any] = await request.json()
    except ValueError:
        return Response(status_code=status.HTTP_200_OK)
    try:
        events_secret = settings.wompi_events_secret
        if events_secret is None:
            logger.error("Llegó un webhook de Wompi sin ALETHEIA_WOMPI_EVENTS_SECRET configurado.")
            return Response(status_code=status.HTTP_200_OK)
        payments_service.procesar_evento(session, payload, events_secret.get_secret_value())
        session.commit()
    except Exception:
        session.rollback()
        logger.exception("Error procesando un webhook de Wompi")
        # 500: que Wompi reintente. Si el problema es nuestro, el reintento sí puede ayudar.
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR) from None
    return Response(status_code=status.HTTP_200_OK)
