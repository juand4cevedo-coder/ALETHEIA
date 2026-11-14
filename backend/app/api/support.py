"""Solicitudes de soporte de cada cuenta y bandeja de la plataforma."""

import datetime
import uuid
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Response, status
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
from app.services.audit import audit_ip
from app.services.sessions import Principal

router = APIRouter(tags=["soporte"])


def _out(ticket: SupportTicket, *, email: str | None = None) -> SupportTicketOut:
    return SupportTicketOut(
        id=ticket.id,
        subject=ticket.subject,
        message=ticket.message,
        status=cast(Literal["open", "closed"], ticket.status),
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        closed_at=ticket.closed_at,
        user_email=email,
    )


@router.post(
    "/support/tickets", status_code=status.HTTP_201_CREATED, summary="Crear solicitud de soporte"
)
def create_support_ticket(
    body: SupportTicketCreate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
) -> SupportTicketOut:
    response.headers["Cache-Control"] = "no-store"
    ticket = SupportTicket(
        user_id=principal.user_id,
        organization_id=principal.organization_id,
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
    principal: Annotated[Principal, Depends(get_principal)],
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
) -> SupportTicketPage:
    del principal
    response.headers["Cache-Control"] = "no-store"
    query = (
        select(SupportTicket, User.email)
        .join(User, User.id == SupportTicket.user_id)
        .order_by(SupportTicket.id.desc())
        .limit(51)
    )
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
    email = session.scalar(select(User.email).where(User.id == ticket.user_id))
    return _out(ticket, email=email)
