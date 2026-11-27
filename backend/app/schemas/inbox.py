"""Esquemas de los avisos dentro de la aplicación (ADR-063)."""

import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    """Un aviso de la campana."""

    id: uuid.UUID
    kind: Literal["task_assigned", "case_member_added", "client_message", "member_joined"] = Field(
        description="Qué lo originó."
    )
    title: str = Field(description="Qué pasó, en una línea.")
    body: str | None = Field(description="Un detalle corto, o null.")
    link: str = Field(description="Ruta del espacio de trabajo donde se atiende el aviso.")
    read: bool = Field(description="Si la persona ya lo vio.")
    created_at: datetime.datetime


class InboxOut(BaseModel):
    """Los avisos más recientes de la persona y cuántos tiene sin leer."""

    items: list[NotificationOut]
    unread: int = Field(description="Avisos sin leer, para el número de la campana.")
