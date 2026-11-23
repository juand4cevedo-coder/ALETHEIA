"""Notas internas de un caso: texto de trabajo, fuera de la cadena de custodia."""

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, ForeignKeyConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk


class CaseNote(Base):
    """Una nota de quien trabaja el expediente. Solo se agregan: no se editan ni se borran, así
    que una corrección es una nota nueva y la historia queda completa."""

    __tablename__ = "case_notes"
    __table_args__ = (
        CheckConstraint("char_length(body) BETWEEN 1 AND 4000", name="body_length"),
        ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
        ),
        Index("ix_case_notes_case_id_id", "case_id", "id"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    case_id: Mapped[uuid.UUID]
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    body: Mapped[str]
    created_at: Mapped[CreatedAt]
