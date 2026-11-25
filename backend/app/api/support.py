"""Solicitudes de soporte de cada cuenta y bandeja de la plataforma."""

import datetime
import uuid
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_principal, get_session
from app.api.platform import get_platform_admin
from app.models import AuditLog, SupportTicket, User
from app.schemas.support import (
    SupportTicketCreate,
    SupportTicketOut,
    SupportTicketPage,
    SupportTicketStatusChange,
)
from app.services import rate_limit
from app.services import support as support_service
from app.services.audit import audit_ip
from app.services.sessions import Principal

router = APIRouter(tags=["soporte"])


def get_support_customer(
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> Principal:
    """La cuenta propietaria atiende solicitudes desde la consola de plataforma."""
    is_owner = session.scalar(select(User.is_platform_admin).where(User.id == principal.user_id))
    if is_owner is True:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="La cuenta propietaria atiende solicitudes desde la consola de plataforma.",
            headers={"Cache-Control": "no-store"},
        )
    return principal


def _out(ticket: SupportTicket, *, email: str | None = None) -> SupportTicketOut:
    return SupportTicketOut(
        id=ticket.id,
        filing_number=ticket.filing_number,
        category=cast(support_service.TicketCategory, ticket.category),
        subject=ticket.subject,
        message=ticket.message,
        status=cast(Literal["open", "closed"], ticket.status),
        due_on=ticket.due_on,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        closed_at=ticket.closed_at,
        deletable_on=support_service.deletable_on(ticket.category, ticket.status, ticket.closed_at),
        # Una cotización sin cuenta responde al correo que dejó en el formulario.
        user_email=email or ticket.contact_email,
        contact_name=ticket.contact_name,
    )


@router.post(
    "/support/tickets",
    status_code=status.HTTP_201_CREATED,
    summary="Crear solicitud de soporte",
    responses={status.HTTP_429_TOO_MANY_REQUESTS: {"description": "Demasiadas solicitudes."}},
)
def create_support_ticket(
    body: SupportTicketCreate,
    response: Response,
    principal: Annotated[Principal, Depends(get_support_customer)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> SupportTicketOut:
    response.headers["Cache-Control"] = "no-store"
    rate_limit.hit(session, rate_limit.SUPPORT_ACCOUNT, str(principal.user_id))
    received_at = datetime.datetime.now(datetime.UTC)
    ticket = SupportTicket(
        user_id=principal.user_id,
        organization_id=principal.organization_id,
        category=body.category,
        filing_number=support_service.next_filing_number(session, received_at),
        due_on=support_service.due_on(body.category, received_at),
        created_at=received_at,
        updated_at=received_at,
        subject=body.subject,
        message=body.message,
    )
    session.add(ticket)
    session.flush()
    session.add(
        AuditLog(
            organization_id=principal.organization_id,
            actor_user_id=principal.user_id,
            action="support_ticket_opened",
            target_id=ticket.id,
            ip=audit_ip(client_ip),
            user_agent=None,
        )
    )
    session.commit()
    return _out(ticket)


@router.get("/support/tickets", summary="Mis solicitudes de soporte")
def own_support_tickets(
    response: Response,
    principal: Annotated[Principal, Depends(get_support_customer)],
    session: Annotated[Session, Depends(get_session)],
    cursor: uuid.UUID | None = None,
) -> SupportTicketPage:
    response.headers["Cache-Control"] = "no-store"
    query = (
        select(SupportTicket)
        .where(SupportTicket.user_id == principal.user_id)
        .order_by(SupportTicket.id.desc())
        .limit(51)
    )
    if cursor is not None:
        query = query.where(SupportTicket.id < cursor)
    tickets = list(session.scalars(query))
    return SupportTicketPage(
        items=[_out(ticket) for ticket in tickets[:50]],
        next_cursor=tickets[49].id if len(tickets) > 50 else None,
    )


@router.get("/platform/support/tickets", summary="Bandeja de soporte de la plataforma")
def platform_support_tickets(
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    cursor: uuid.UUID | None = None,
    ticket_status: Annotated[Literal["open", "closed"] | None, Query(alias="status")] = None,
) -> SupportTicketPage:
    del principal
    response.headers["Cache-Control"] = "no-store"
    query = (
        select(SupportTicket, User.email)
        .outerjoin(User, User.id == SupportTicket.user_id)
        .order_by(SupportTicket.id.desc())
        .limit(51)
    )
    if ticket_status is not None:
        query = query.where(SupportTicket.status == ticket_status)
    if cursor is not None:
        query = query.where(SupportTicket.id < cursor)
    rows = session.execute(query).all()
    return SupportTicketPage(
        items=[_out(ticket, email=email) for ticket, email in rows[:50]],
        next_cursor=rows[49][0].id if len(rows) > 50 else None,
    )


@router.patch(
    "/platform/support/tickets/{ticket_id}/status", summary="Resolver o reabrir solicitud"
)
def change_support_ticket_status(
    ticket_id: uuid.UUID,
    change: SupportTicketStatusChange,
    response: Response,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> SupportTicketOut:
    response.headers["Cache-Control"] = "no-store"
    ticket = session.scalar(
        select(SupportTicket).where(SupportTicket.id == ticket_id).with_for_update()
    )
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="La solicitud no existe.")
    if ticket.status != change.status:
        now = datetime.datetime.now(datetime.UTC)
        ticket.status = change.status
        ticket.updated_at = now
        ticket.closed_at = now if change.status == "closed" else None
        session.add(
            AuditLog(
                organization_id=None,
                actor_user_id=principal.user_id,
                action="support_ticket_closed"
                if change.status == "closed"
                else "support_ticket_reopened",
                target_id=ticket.id,
                ip=audit_ip(client_ip),
                user_agent=None,
                created_at=now,
            )
        )
        session.commit()
    email = (
        session.scalar(select(User.email).where(User.id == ticket.user_id))
        if ticket.user_id is not None
        else None
    )
    return _out(ticket, email=email)


@router.delete(
    "/platform/support/tickets/{ticket_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar una solicitud resuelta",
    responses={
        404: {"description": "La solicitud no existe."},
        409: {"description": "Sigue abierta o todavía debe conservarse."},
    },
)
def delete_support_ticket(
    ticket_id: uuid.UUID,
    principal: Annotated[Principal, Depends(get_platform_admin)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> Response:
    ticket = session.scalar(
        select(SupportTicket).where(SupportTicket.id == ticket_id).with_for_update()
    )
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="La solicitud no existe.")
    allowed_from = support_service.deletable_on(ticket.category, ticket.status, ticket.closed_at)
    today = datetime.datetime.now(datetime.UTC).astimezone(support_service.BOGOTA).date()
    if allowed_from is None or allowed_from > today:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Esta solicitud debe conservarse: solo se elimina una vez resuelta y, si es de "
                "datos personales, consumidor o reembolso, tres años después de cerrada."
            ),
        )
    filing_number = ticket.filing_number
    category = ticket.category
    session.delete(ticket)
    session.add(
        AuditLog(
            organization_id=None,
            actor_user_id=principal.user_id,
            action="support_ticket_deleted",
            target_id=ticket_id,
            details={"filing_number": filing_number, "category": category},
            ip=audit_ip(client_ip),
            user_agent=None,
        )
    )
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})
