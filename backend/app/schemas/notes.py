"""Notas internas de un caso."""

import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field


class CaseNoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    body: str = Field(min_length=1, max_length=4000, description="Texto de la nota.")


class CaseNoteOut(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    author_id: uuid.UUID
    author_name: str
    body: str
    created_at: datetime.datetime


class CaseNotePage(BaseModel):
    items: list[CaseNoteOut]
    next_cursor: uuid.UUID | None
