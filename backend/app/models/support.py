"""Solicitudes de soporte vinculadas a una cuenta, sin adjuntos de expedientes."""

import datetime
import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk, text_values

TICKET_STATUSES = ("open", "closed")


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = (
        CheckConstraint("char_length(subject) BETWEEN 5 AND 120", name="subject_length"),
        CheckConstraint("char_length(message) BETWEEN 10 AND 3000", name="message_length"),
        CheckConstraint(text_values("status", TICKET_STATUSES), name="status"),
        Index("ix_support_tickets_created_at", "created_at"),
    )

    id: Mapped[UUIDv7Pk]
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL")
    )
    subject: Mapped[str]
    message: Mapped[str]
    status: Mapped[str] = mapped_column(server_default="open")
    created_at: Mapped[CreatedAt]
    updated_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
    closed_at: Mapped[datetime.datetime | None]
