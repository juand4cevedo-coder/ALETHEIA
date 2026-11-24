"""Solicitudes de soporte vinculadas a una cuenta, sin adjuntos de expedientes."""

import datetime
import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk, text_values

TICKET_STATUSES = ("open", "closed")

# Tipos de solicitud. Cada uno tiene su plazo legal de respuesta (services/support.py).
TICKET_CATEGORIES = ("support", "data_query", "data_claim", "consumer", "refund")


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = (
        CheckConstraint("char_length(subject) BETWEEN 5 AND 120", name="subject_length"),
        CheckConstraint("char_length(message) BETWEEN 10 AND 3000", name="message_length"),
        CheckConstraint(text_values("status", TICKET_STATUSES), name="status"),
        CheckConstraint(text_values("category", TICKET_CATEGORIES), name="category"),
        Index("ix_support_tickets_created_at", "created_at"),
        # Bandeja de la plataforma: lo abierto, primero lo que vence antes.
        Index("ix_support_tickets_status_due_on", "status", "due_on"),
        # "Mis solicitudes de soporte": filtra por persona y ordena por el cursor (IDX-014).
        Index("ix_support_tickets_user_id_id", "user_id", "id"),
    )

    id: Mapped[UUIDv7Pk]
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL")
    )
    category: Mapped[str] = mapped_column(server_default="support")
    filing_number: Mapped[str] = mapped_column(unique=True)
    due_on: Mapped[datetime.date]
    subject: Mapped[str]
    message: Mapped[str]
    status: Mapped[str] = mapped_column(server_default="open")
    created_at: Mapped[CreatedAt]
    updated_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
    closed_at: Mapped[datetime.datetime | None]
