"""Enlaces para compartir una sola evidencia, con vencimiento y sin cuenta."""

import datetime
import uuid

from sqlalchemy import CheckConstraint, ForeignKey, ForeignKeyConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models._columns import CreatedAt, UUIDv7Pk


class EvidenceShareLink(Base):
    """El enlace no se guarda: va firmado. Aquí viven su vigencia, su revocación y su uso."""

    __tablename__ = "evidence_share_links"
    __table_args__ = (
        CheckConstraint("label IS NULL OR char_length(label) BETWEEN 1 AND 120", name="label"),
        CheckConstraint("download_count >= 0", name="download_count"),
        ForeignKeyConstraint(
            ["organization_id", "case_id"],
            ["cases.organization_id", "cases.id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["case_id", "evidence_id"],
            ["evidences.case_id", "evidences.id"],
            ondelete="CASCADE",
        ),
        Index("ix_evidence_share_links_evidence_id_created_at", "evidence_id", "created_at"),
    )

    id: Mapped[UUIDv7Pk]
    organization_id: Mapped[uuid.UUID]
    case_id: Mapped[uuid.UUID]
    evidence_id: Mapped[uuid.UUID]
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    label: Mapped[str | None]
    expires_at: Mapped[datetime.datetime]
    revoked_at: Mapped[datetime.datetime | None]
    revoked_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT")
    )
    download_count: Mapped[int] = mapped_column(server_default="0")
    last_downloaded_at: Mapped[datetime.datetime | None]
    created_at: Mapped[CreatedAt]
