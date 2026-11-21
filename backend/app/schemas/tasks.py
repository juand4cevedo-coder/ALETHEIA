"""Contrato de tareas y plazos de un caso."""

import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TaskPriority = Literal["low", "normal", "high", "urgent"]
TaskStatus = Literal["pending", "in_progress", "completed", "canceled"]


class CaseTaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, min_length=1, max_length=1000)
    priority: TaskPriority = "normal"
    due_at: datetime.datetime | None = None
    assigned_to: uuid.UUID

    @field_validator("due_at")
    @classmethod
    def _timezone_required(cls, value: datetime.datetime | None) -> datetime.datetime | None:
        if value is not None and value.utcoffset() is None:
            raise ValueError("La fecha límite debe incluir zona horaria.")
        return value


class CaseTaskStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: TaskStatus


class CaseTaskOut(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    title: str
    description: str | None
    priority: TaskPriority
    status: TaskStatus
    due_at: datetime.datetime | None
    assigned_to: uuid.UUID
    assignee_name: str
    created_by: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime
    completed_at: datetime.datetime | None


class CaseTaskPage(BaseModel):
    items: list[CaseTaskOut]
    next_cursor: uuid.UUID | None


class TaskInboxItem(CaseTaskOut):
    case_title: str
    case_status: Literal["open", "closed"]


class TaskInboxOut(BaseModel):
    items: list[TaskInboxItem]
    active: int
    overdue: int
    due_soon: int
