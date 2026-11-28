"""Primer cobro de una suscripción con Wompi, por Nequi (HU-027), y su webhook."""

import json
import logging
import uuid
from typing import Annotated, Any, Final, Literal, cast

import anyio.from_thread
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.api.deps import get_app_settings, get_client_ip, get_principal, get_session
from app.core.config import Settings
from app.core.permissions import has_permission
from app.schemas.billing import (
    BillingQuoteOption,
    BillingQuoteOut,
    CheckoutCreate,
    CheckoutOut,
    CheckoutWebCreate,
    CheckoutWebOut,
    CheckoutWebResult,
    PaymentSourceConfirm,
    PaymentSourceOut,
    PaymentSourceStart,
    PaymentSourceStatusOut,
    ReceiptOut,
    WompiTermsOut,
)
from app.services import checkout as checkout_service
from app.services import payment_sources as sources_service
from app.services import payments as payments_service
from app.services import pricing, receipt_pdf
from app.services import receipts as receipts_service
from app.services.sessions import Principal

router = APIRouter(tags=["facturación"])
logger = logging.getLogger(__name__)

_NO_STORE = {"Cache-Control": "no-store"}
_ESTADOS: Final = frozenset({"PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"})


def _team_too_big(exc: checkout_service.EquipoNoCabeError) -> HTTPException:
    people = "persona" if exc.users == 1 else "personas"
    included = "usuario" if exc.included == 1 else "usuarios"
    capacity = (
        f"ese plan admite hasta {exc.limit} personas contando los adicionales"
        if exc.limit is not None
        else f"ese plan incluye {exc.included} {included} sin adicionales"
    )
    return HTTPException(
        status.HTTP_409_CONFLICT,
        detail=(
            f"Su equipo tiene {exc.users} {people}, contando las invitaciones abiertas, y "
            f"{capacity}. Elija un plan más amplio o retire personas en Equipo."
        ),
        headers=_NO_STORE,
    )


_TEAM_TOO_BIG: Final[dict[int | str, dict[str, Any]]] = {
    status.HTTP_409_CONFLICT: {"description": "El equipo tiene más personas de las que admite."}
}


@router.get(
    "/billing/quote",
    summary="Lo que costaría cada plan para el equipo de hoy, antes de pagar",
    responses={status.HTTP_403_FORBIDDEN: {"description": "El rol no administra la facturación."}},
)
def billing_quote(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> BillingQuoteOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        users, options = checkout_service.opciones(session, principal)
    except checkout_service.CheckoutNoPermitidoError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Solo la persona responsable del despacho consulta lo que vale cada plan.",
            headers=_NO_STORE,
        ) from None
    out: list[BillingQuoteOption] = []
    for option in options:
        quote = option.cotizacion
        plan = option.plan
        if quote is None:
            price = pricing.plan_price(plan, option.billing_cycle) or 0
            out.append(
                BillingQuoteOption(
                    plan_code=plan.code,
                    plan_name=plan.name,
                    billing_cycle=option.billing_cycle,
                    included_users=plan.included_users,
                    max_users=pricing.max_users(plan),
                    fits=False,
                    plan_cop=price,
                    extra_users=0,
                    extra_user_unit_cop=None,
                    extra_users_cop=0,
                    total_cop=price,
                )
            )
            continue
        out.append(
            BillingQuoteOption(
                plan_code=plan.code,
                plan_name=plan.name,
                billing_cycle=option.billing_cycle,
                included_users=plan.included_users,
                max_users=pricing.max_users(plan),
                fits=True,
                plan_cop=quote.plan_cop,
                extra_users=quote.extra_users,
                extra_user_unit_cop=pricing.extra_user_unit(plan, option.billing_cycle),
                extra_users_cop=quote.extra_users_cop,
                total_cop=quote.total_cop,
            )
        )
    return BillingQuoteOut(users=users, options=out)


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
        **_TEAM_TOO_BIG,
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
    except checkout_service.EquipoNoCabeError as exc:
        session.rollback()
        raise _team_too_big(exc) from None
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
    "/billing/checkout-web",
    summary="Iniciar un cobro en el Checkout Web de Wompi (tarjeta, PSE, Nequi y otros)",
    responses={
        status.HTTP_403_FORBIDDEN: {"description": "El rol no administra la facturación."},
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": "El plan o el ciclo no son válidos."
        },
        **_TEAM_TOO_BIG,
        status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "La pasarela no está disponible."},
    },
)
def create_checkout_web(
    body: CheckoutWebCreate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> CheckoutWebOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        url = checkout_service.iniciar_checkout_web(
            session, settings, principal, body.plan_code, body.billing_cycle
        )
        session.commit()
    except checkout_service.EquipoNoCabeError as exc:
        session.rollback()
        raise _team_too_big(exc) from None
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
    return CheckoutWebOut(checkout_url=url)


@router.post(
    "/billing/checkout-web/confirm",
    summary="Confirmar el resultado de un cobro al volver del Checkout Web",
    responses={
        status.HTTP_403_FORBIDDEN: {"description": "El rol no administra la facturación."},
        status.HTTP_404_NOT_FOUND: {"description": "No hay un pago en curso para este despacho."},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Wompi no respondió."},
    },
)
def confirm_checkout_web(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> CheckoutWebResult:
    response.headers["Cache-Control"] = "no-store"
    try:
        estado = checkout_service.confirmar_regreso(session, settings, principal)
        session.commit()
    except checkout_service.CheckoutNoPermitidoError:
        session.rollback()
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para esta acción.",
            headers=_NO_STORE,
        ) from None
    except checkout_service.TransaccionAjenaError, wompi.WompiRechazadoError:
        session.rollback()
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="No hay un pago en curso para este despacho.",
            headers=_NO_STORE,
        ) from None
    except wompi.WompiNoConfiguradoError, wompi.WompiNoDisponibleError:
        session.rollback()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Wompi no respondió; inténtelo de nuevo en un momento.",
            headers=_NO_STORE,
        ) from None
    if estado not in _ESTADOS:
        logger.error("Wompi devolvió un estado de transacción desconocido: %s", estado)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, headers=_NO_STORE)
    return CheckoutWebResult(
        status=cast(Literal["PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR"], estado)
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


def _may_see_receipts(principal: Principal) -> None:
    if principal.organization_id is None or not has_permission(principal.role, "billing.manage"):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Solo la persona responsable del despacho consulta sus comprobantes.",
            headers=_NO_STORE,
        )


@router.get(
    "/billing/receipts",
    summary="Comprobantes de pago del despacho",
    responses={status.HTTP_403_FORBIDDEN: {"description": "El rol no administra la facturación."}},
)
def list_receipts(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> list[ReceiptOut]:
    response.headers["Cache-Control"] = "no-store"
    _may_see_receipts(principal)
    return [
        ReceiptOut(
            id=receipt.id,
            number=receipt.number,
            issued_at=receipt.issued_at,
            plan_name=receipt.plan_name,
            billing_cycle=cast(Literal["monthly", "annual"], receipt.billing_cycle),
            amount_cop=receipt.amount_cop,
            extra_users=receipt.extra_users,
            extra_users_cop=receipt.extra_users_cop,
            payment_method=receipt.payment_method,
            period_start=receipt.period_start,
            period_end=receipt.period_end,
            transaction_id=receipt.gateway_transaction_id,
        )
        for receipt in receipts_service.list_for(session, principal)
    ]


@router.get(
    "/billing/receipts/{receipt_id}/pdf",
    summary="Descargar un comprobante de pago en PDF",
    response_class=Response,
    responses={
        status.HTTP_200_OK: {"content": {"application/pdf": {}}},
        status.HTTP_403_FORBIDDEN: {"description": "El rol no administra la facturación."},
        status.HTTP_404_NOT_FOUND: {"description": "No hay un comprobante así en este despacho."},
    },
)
def download_receipt(
    receipt_id: uuid.UUID,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> Response:
    _may_see_receipts(principal)
    receipt = receipts_service.get_for(session, principal, receipt_id)
    if receipt is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="No encontramos ese comprobante.",
            headers=_NO_STORE,
        )
    return Response(
        content=receipt_pdf.render(receipt),
        media_type="application/pdf",
        headers={
            **_NO_STORE,
            "Content-Disposition": f'attachment; filename="comprobante-{receipt.number}.pdf"',
        },
    )


def _source_view(view: sources_service.SourceView | None) -> PaymentSourceStatusOut | None:
    if view is None:
        return None
    return PaymentSourceStatusOut(
        status=cast(Literal["pending", "active", "declined", "canceled"], view.status),
        phone_last4=view.phone_last4,
        linked_at=view.linked_at,
    )


def _source_errors(exc: Exception) -> HTTPException:
    if isinstance(exc, sources_service.RecurringUnavailableError):
        return HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="La renovación automática todavía no está disponible.",
            headers=_NO_STORE,
        )
    if isinstance(exc, sources_service.NotAllowedError):
        return HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Solo la persona responsable del despacho vincula una fuente de pago.",
            headers=_NO_STORE,
        )
    if isinstance(exc, sources_service.ConsentMismatchError):
        return HTTPException(
            status.HTTP_409_CONFLICT,
            detail="El texto de la autorización cambió. Recargue la página y léalo de nuevo.",
            headers=_NO_STORE,
        )
    if isinstance(exc, sources_service.AlreadyLinkedError):
        return HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Ya hay una fuente de pago vinculada o en trámite. Cancélela primero.",
            headers=_NO_STORE,
        )
    if isinstance(exc, sources_service.NothingToConfirmError):
        return HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="No hay una vinculación en trámite.",
            headers=_NO_STORE,
        )
    if isinstance(exc, wompi.WompiRechazadoError):
        return HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Wompi no aceptó la vinculación. Revise el número e inténtelo de nuevo.",
            headers=_NO_STORE,
        )
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Wompi no respondió; inténtelo de nuevo en un momento.",
        headers=_NO_STORE,
    )


_SOURCE_EXCEPTIONS = (
    sources_service.RecurringUnavailableError,
    sources_service.NotAllowedError,
    sources_service.ConsentMismatchError,
    sources_service.AlreadyLinkedError,
    sources_service.NothingToConfirmError,
    wompi.WompiRechazadoError,
    wompi.WompiNoConfiguradoError,
    wompi.WompiNoDisponibleError,
)


@router.get(
    "/billing/payment-source",
    summary="La fuente de pago para la renovación automática",
    responses={status.HTTP_403_FORBIDDEN: {"description": "El rol no administra la facturación."}},
)
def read_payment_source(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> PaymentSourceOut:
    response.headers["Cache-Control"] = "no-store"
    if not settings.recurring_payments_enabled:
        return PaymentSourceOut(
            enabled=False,
            consent_version=sources_service.CONSENT_VERSION,
            consent_text=sources_service.CONSENT_TEXT,
            source=None,
        )
    try:
        view = sources_service.current(session, settings, principal)
    except _SOURCE_EXCEPTIONS as exc:
        raise _source_errors(exc) from None
    return PaymentSourceOut(
        enabled=True,
        consent_version=sources_service.CONSENT_VERSION,
        consent_text=sources_service.CONSENT_TEXT,
        source=_source_view(view),
    )


@router.post(
    "/billing/payment-source",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Empezar a vincular el Nequi para renovar solo",
)
def start_payment_source(
    body: PaymentSourceStart,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> PaymentSourceStatusOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        view = sources_service.start(
            session,
            settings,
            principal,
            phone_number=body.phone_number,
            consent_version=body.consent_version,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        session.commit()
    except _SOURCE_EXCEPTIONS as exc:
        session.rollback()
        raise _source_errors(exc) from None
    return cast(PaymentSourceStatusOut, _source_view(view))


@router.post(
    "/billing/payment-source/confirm",
    summary="Confirmar que la persona aprobó la vinculación en su celular",
)
def confirm_payment_source(
    body: PaymentSourceConfirm,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> PaymentSourceStatusOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        view = sources_service.confirm(
            session,
            settings,
            principal,
            acceptance_token=body.acceptance_token,
            accept_personal_auth=body.accept_personal_auth,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        session.commit()
    except _SOURCE_EXCEPTIONS as exc:
        session.rollback()
        raise _source_errors(exc) from None
    return cast(PaymentSourceStatusOut, _source_view(view))


@router.delete(
    "/billing/payment-source",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancelar la renovación automática",
)
def cancel_payment_source(
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> Response:
    try:
        sources_service.cancel(
            session, settings, principal, client_ip=client_ip, user_agent=user_agent
        )
        session.commit()
    except _SOURCE_EXCEPTIONS as exc:
        session.rollback()
        raise _source_errors(exc) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)
