"""Primer cobro de una suscripción con Wompi, por Nequi (HU-027), y su webhook."""

import json
import logging
from typing import Annotated, Any, Final, Literal, cast

import anyio.from_thread
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.api.deps import get_app_settings, get_principal, get_session
from app.core.config import Settings
from app.schemas.billing import CheckoutCreate, CheckoutOut, WompiTermsOut
from app.services import checkout as checkout_service
from app.services import payments as payments_service
from app.services.sessions import Principal

router = APIRouter(tags=["facturación"])
logger = logging.getLogger(__name__)

_NO_STORE = {"Cache-Control": "no-store"}
_ESTADOS: Final = frozenset({"PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"})


@router.get(
    "/billing/wompi-terms",
    summary="Contratos de Wompi que hay que mostrar antes de cobrar",
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Wompi no respondió."}},
)
def wompi_terms(
    response: Response, settings: Annotated[Settings, Depends(get_app_settings)]
) -> WompiTermsOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        creds = wompi.credenciales_de(settings)
        tokens = wompi.tokens_de_aceptacion(creds)
    except wompi.WompiNoConfiguradoError, wompi.WompiNoDisponibleError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La pasarela de pagos no está disponible.",
            headers=_NO_STORE,
        ) from None
    return WompiTermsOut(
        acceptance_token=tokens.acceptance_token,
        acceptance_permalink=tokens.acceptance_permalink,
        accept_personal_auth=tokens.accept_personal_auth,
        personal_auth_permalink=tokens.personal_auth_permalink,
    )


@router.post(
    "/billing/checkout",
    summary="Iniciar el primer cobro de una suscripción con Nequi",
    responses={
        status.HTTP_403_FORBIDDEN: {"description": "El rol no administra la facturación."},
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
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
            session,
            settings,
            principal,
            body.plan_code,
            body.billing_cycle,
            body.phone_number,
            body.acceptance_token,
            body.accept_personal_auth,
        )
        session.commit()
    except checkout_service.CheckoutNoPermitidoError:
        session.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
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
            status.HTTP_422_UNPROCESSABLE_CONTENT,
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
def wompi_webhook(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> Response:
    # def, no async def: lo de aquí abajo (la base, y GET /transactions contra Wompi) bloquea
    # de verdad, y con un solo trabajador de uvicorn un async def bloquearía el bucle de
    # eventos entero. FastAPI corre un def en un hilo aparte (igual que evidence_stream.py);
    # el cuerpo de la petición se lee desde ese hilo con anyio.from_thread.run.
    cuerpo = anyio.from_thread.run(request.body)
    # Wompi reintenta hasta tres veces en 24 horas si no recibe 200; el cuerpo no importa
    # (guía de Events). Un cuerpo que no es JSON se ignora con 200, para no gastar reintentos
    # en algo que nunca va a procesarse.
    try:
        payload: dict[str, Any] = json.loads(cuerpo)
    except ValueError:
        return Response(status_code=status.HTTP_200_OK)
    try:
        creds = wompi.credenciales_de(settings)
        payments_service.procesar_evento(session, payload, creds)
        session.commit()
    except wompi.WompiNoConfiguradoError:
        session.rollback()
        logger.error("Llegó un webhook de Wompi sin las variables ALETHEIA_WOMPI_* configuradas.")
        return Response(status_code=status.HTTP_200_OK)
    except Exception:
        session.rollback()
        logger.exception("Error procesando un webhook de Wompi")
        # 500: que Wompi reintente. Si el problema es nuestro, el reintento sí puede ayudar.
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR) from None
    return Response(status_code=status.HTTP_200_OK)
