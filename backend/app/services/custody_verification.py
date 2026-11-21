"""Verificación independiente de los eventos guardados de un caso asignado."""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import CustodyAnchor
from app.repositories import cases as cases_repository
from app.services import custody_chain
from app.services.cases import CaseNotFoundError
from app.services.sessions import Principal


@dataclass(frozen=True, slots=True)
class VerificationResult:
    """Cadena recalculada y último testigo externo visible para el caso."""

    report: custody_chain.ChainReport
    latest_anchor: CustodyAnchor | None


def verify_case(session: Session, principal: Principal, case_id: uuid.UUID) -> VerificationResult:
    organization_id = principal.organization_id
    if organization_id is None:
        raise CaseNotFoundError
    set_tenant(session, TenantContext(organization_id, principal.user_id))
    # El candado compartido evita atribuir a una alteración un evento que entra mientras
    # se leen los eventos. Las escrituras de custodia actualizan la fila del caso.
    case = cases_repository.case_for_member_read_lock(session, case_id, principal.user_id)
    if case is None or case.organization_id != organization_id:
        raise CaseNotFoundError

    report = custody_chain.verify(
        custody_chain.load(session, case_id), expected_count=case.custody_seq
    )
    latest_anchor = session.scalar(
        select(CustodyAnchor)
        .where(CustodyAnchor.case_id == case_id)
        .order_by(CustodyAnchor.seq.desc())
        .limit(1)
    )
    return VerificationResult(report=report, latest_anchor=latest_anchor)
