"""Solicitudes de cotización del plan Corporativo, desde el formulario público de /empresa.

Llegan a la bandeja de soporte de la plataforma como una solicitud de tipo comercial (`sales`),
con su radicado. Quien escribe no tiene cuenta: su nombre y su correo quedan en la solicitud y
la solicitud no queda ligada a ninguna persona usuaria. La petición pública puede crearla, pero
no leerla (migración 0065), así que se inserta sin pedir de vuelta la fila.
"""

import datetime
import uuid
from typing import Final

from sqlalchemy import insert
from sqlalchemy.orm import Session

from app.models import AuditLog, SupportTicket
from app.schemas.sales import SalesInquiryCreate
from app.services import rate_limit
from app.services import support as support_service
from app.services.audit import audit_ip

CATEGORY: Final = "sales"


def subject_for(inquiry: SalesInquiryCreate) -> str:
    return f"Cotización del plan Corporativo: {inquiry.organization}"[:120]


def message_for(inquiry: SalesInquiryCreate) -> str:
    people = "usuario" if inquiry.users == 1 else "usuarios"
    lines = [
        f"Firma u oficina: {inquiry.organization}",
        f"Usuarios aproximados: {inquiry.users} {people}",
        f"Contacto: {inquiry.name} <{inquiry.email}>",
    ]
    if inquiry.message:
        lines += ["", inquiry.message]
    return "\n".join(lines)[:3000]


def open_inquiry(session: Session, inquiry: SalesInquiryCreate, client_ip: str) -> str:
    """Registra la solicitud y devuelve su radicado. RateLimitExceededError si se pasó del tope."""
    rate_limit.hit(session, rate_limit.SALES_INQUIRY_IP, client_ip)
    rate_limit.hit(session, rate_limit.SALES_INQUIRY_EMAIL, inquiry.email)
    received_at = datetime.datetime.now(datetime.UTC)
    ticket_id = uuid.uuid7()
    filing_number = support_service.next_filing_number(session, received_at)
    session.execute(
        insert(SupportTicket).values(
            id=ticket_id,
            user_id=None,
            organization_id=None,
            contact_name=inquiry.name,
            contact_email=inquiry.email,
            category=CATEGORY,
            filing_number=filing_number,
            due_on=support_service.due_on(CATEGORY, received_at),
            subject=subject_for(inquiry),
            message=message_for(inquiry),
            status="open",
            created_at=received_at,
            updated_at=received_at,
        )
    )
    session.add(
        AuditLog(
            organization_id=None,
            actor_user_id=None,
            action="support_ticket_opened",
            target_id=ticket_id,
            ip=audit_ip(client_ip),
            user_agent=None,
            created_at=received_at,
        )
    )
    return filing_number
