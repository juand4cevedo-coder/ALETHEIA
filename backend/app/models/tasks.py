"""Tareas y plazos operativos vinculados a un caso."""

import datetime
import uuid
from typing import Final

from sqlalchemy import CheckConstraint, ForeignKey, ForeignKeyConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk, text_values

TASK_PRIORITIES: Final = ("low", "normal", "high", "urgent")
TASK_STATUSES: Final = ("pending", "in_progress", "completed", "canceled")


class CaseTask(Base):
    """Trabajo asignable dentro de un caso; nunca se elimina para conservar su historia."""

    __tablename__ = "case_tasks"
    __table_args__ = (
        CheckConstraint("char_length(title) BETWEEN 1 AND 160", name="title_length"),
        CheckConstraint(
            "description IS NULL OR char_length(description) BETWEEN 1 AND 1000",
            name="description_length",
        ),
        CheckConstraint(text_values("priority", TASK_PRIORITIES), name="priority"),
        CheckConstraint(text_values("status", TASK_STATUSES), name="status"),
        CheckConstraint(
            "(status = 'completed') = (completed_at IS NOT NULL)",
            name="completed_at",
        ),
        ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
        ),
        ForeignKeyConstraint(
            ["case_id", "assigned_to"],
            ["case_members.case_id", "case_members.user_id"],
            ondelete="RESTRICT",
        ),
        Index("ix_case_tasks_case_id_id", "case_id", "id"),
        Index("ix_case_tasks_assigned_to_status_due_at", "assigned_to", "status", "due_at"),
        Index(
            "ix_case_tasks_organization_status_due_at",
            "organization_id",
            "status",
            "due_at",
        ),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    case_id: Mapped[uuid.UUID]
    title: Mapped[str]
    description: Mapped[str | None]
    priority: Mapped[str] = mapped_column(server_default="normal")
    status: Mapped[str] = mapped_column(server_default="pending")
    due_at: Mapped[datetime.datetime | None]
    assigned_to: Mapped[uuid.UUID]
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[CreatedAt]
    updated_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
    completed_at: Mapped[datetime.datetime | None]
