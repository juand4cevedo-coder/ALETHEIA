"""Avisos dentro de la aplicación: lo que una persona tiene pendiente de ver (ADR-063)."""

import datetime
import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk, text_values

NOTIFICATION_KINDS = (
    "task_assigned",
    "case_member_added",
    "client_message",
    "member_joined",
)


class Notification(Base):
    """Un aviso para una persona de un despacho. Lo ve solo ella: la política de fila exige su
    organización y su usuario. No copia datos del expediente; nombra el caso y lleva el enlace."""

    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(text_values("kind", NOTIFICATION_KINDS), name="kind"),
        CheckConstraint("char_length(title) BETWEEN 1 AND 160", name="title_length"),
        CheckConstraint("body IS NULL OR char_length(body) BETWEEN 1 AND 300", name="body_length"),
        CheckConstraint("char_length(link) BETWEEN 1 AND 300 AND link LIKE '/app%'", name="link"),
        # La lista de la campana: las de una persona, de la más reciente a la más antigua.
        Index("ix_notifications_user_id_created_at", "user_id", text("created_at DESC")),
        Index(
            "ix_notifications_unread",
            "user_id",
            postgresql_where=text("read_at IS NULL"),
        ),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str]
    title: Mapped[str]
    body: Mapped[str | None]
    link: Mapped[str]
    read_at: Mapped[datetime.datetime | None]
    created_at: Mapped[CreatedAt]
