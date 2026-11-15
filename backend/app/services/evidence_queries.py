"""Consultas de evidencias y sus eventos para miembros de un caso."""

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import CustodyEvent, Evidence, User
from app.repositories import cases as cases_repository
from app.services.cases import CaseNotFoundError
from app.services.sessions import Principal


@dataclass(frozen=True)
class EvidenceEvent:
    seq: int
    action: str
    actor_name: str | None
    occurred_at: datetime.datetime
    event_hash: bytes


def list_evidences(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    *,
    cursor: uuid.UUID | None,
    limit: int,
) -> tuple[list[Evidence], uuid.UUID | None]:
    organization_id = principal.organization_id
    if organization_id is None:
        raise CaseNotFoundError
    set_tenant(session, TenantContext(organization_id, principal.user_id))
    case = cases_repository.case_for_member(session, case_id, principal.user_id)
    if case is None or case.organization_id != organization_id:
        raise CaseNotFoundError
    statement = select(Evidence).where(
        Evidence.organization_id == organization_id, Evidence.case_id == case_id
    )
    if cursor is not None:
        statement = statement.where(Evidence.id < cursor)
    rows = list(session.scalars(statement.order_by(Evidence.id.desc()).limit(limit + 1)))
    has_more = len(rows) > limit
    items = rows[:limit]
    return items, items[-1].id if has_more else None


def get_evidence(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    *,
    event_cursor: int | None,
    event_limit: int = 50,
) -> tuple[Evidence, list[EvidenceEvent], int | None]:
    organization_id = principal.organization_id
    if organization_id is None:
        raise CaseNotFoundError
    set_tenant(session, TenantContext(organization_id, principal.user_id))
    case = cases_repository.case_for_member(session, case_id, principal.user_id)
    if case is None or case.organization_id != organization_id:
        raise CaseNotFoundError
    evidence = session.scalar(
        select(Evidence).where(
            Evidence.id == evidence_id,
            Evidence.case_id == case_id,
            Evidence.organization_id == organization_id,
        )
    )
    if evidence is None:
        raise CaseNotFoundError
    statement = (
        select(
            CustodyEvent.seq,
            CustodyEvent.action,
            User.full_name,
            CustodyEvent.occurred_at,
            CustodyEvent.event_hash,
        )
        .outerjoin(User, User.id == CustodyEvent.actor_user_id)
        .where(
            CustodyEvent.organization_id == organization_id,
            CustodyEvent.case_id == case_id,
            CustodyEvent.evidence_id == evidence_id,
        )
    )
    if event_cursor is not None:
        statement = statement.where(CustodyEvent.seq < event_cursor)
    rows = list(session.execute(statement.order_by(CustodyEvent.seq.desc()).limit(event_limit + 1)))
    page = [EvidenceEvent(*row) for row in rows[:event_limit]]
    return evidence, page, page[-1].seq if len(rows) > event_limit else None
