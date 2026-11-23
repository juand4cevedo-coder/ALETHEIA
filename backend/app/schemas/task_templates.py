"""Contrato de las plantillas de tareas."""

import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.tasks import CaseTaskOut, TaskPriority

MAX_ITEMS = 30


class TaskTemplateItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, min_length=1, max_length=1000)
    priority: TaskPriority = "normal"
    due_days: int | None = Field(
        default=None,
        ge=0,
        le=365,
        description="Días de plazo desde que se aplica la plantilla; null si no lleva plazo.",
    )


class TaskTemplateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    items: list[TaskTemplateItemIn] = Field(min_length=1, max_length=MAX_ITEMS)


class TaskTemplateItemOut(BaseModel):
    title: str
    description: str | None
    priority: TaskPriority
    due_days: int | None


class TaskTemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime.datetime
    items: list[TaskTemplateItemOut]


class TaskTemplateList(BaseModel):
    items: list[TaskTemplateOut]


class ApplyTaskTemplate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    template_id: uuid.UUID
    assigned_to: uuid.UUID = Field(description="Responsable de todas las tareas creadas.")


class AppliedTaskTemplate(BaseModel):
    tasks: list[CaseTaskOut]
