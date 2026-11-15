"""Consulta paginada de los metadatos de evidencia de un caso asignado."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import Evidence
from app.repositories import cases as cases_repository
from app.services.cases import CaseNotFoundError
from app.services.sessions import Principal


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
