"""Plantillas de tareas: listas que un despacho repite en sus casos."""

import uuid

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk


class TaskTemplate(Base):
    """Una plantilla del despacho, con un nombre único dentro de él."""

    __tablename__ = "task_templates"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 1 AND 120", name="name"),
        UniqueConstraint("organization_id", "name"),
        UniqueConstraint("organization_id", "id"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT")
    )
    name: Mapped[str]
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[CreatedAt]


class TaskTemplateItem(Base):
    """Una tarea de la plantilla: título, prioridad y días de plazo desde que se aplica."""

    __tablename__ = "task_template_items"
    __table_args__ = (
        CheckConstraint("char_length(title) BETWEEN 1 AND 160", name="title"),
        CheckConstraint(
            "description IS NULL OR char_length(description) BETWEEN 1 AND 1000",
            name="description",
        ),
        CheckConstraint("priority IN ('low', 'normal', 'high', 'urgent')", name="priority"),
        CheckConstraint("due_days IS NULL OR due_days BETWEEN 0 AND 365", name="due_days"),
        ForeignKeyConstraint(
            ["organization_id", "template_id"],
            ["task_templates.organization_id", "task_templates.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("template_id", "position"),
        Index("ix_task_template_items_template_id_position", "template_id", "position"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    template_id: Mapped[uuid.UUID]
    position: Mapped[int] = mapped_column(SmallInteger)
    title: Mapped[str]
    description: Mapped[str | None]
    priority: Mapped[str] = mapped_column(server_default="normal")
    due_days: Mapped[int | None] = mapped_column(SmallInteger)
