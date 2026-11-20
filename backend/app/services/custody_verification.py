"""Verificación independiente de los eventos guardados de un caso asignado."""

import uuid

from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.repositories import cases as cases_repository
from app.services import custody_chain
from app.services.cases import CaseNotFoundError
from app.services.sessions import Principal


def verify_case(
    session: Session, principal: Principal, case_id: uuid.UUID
) -> custody_chain.ChainReport:
    organization_id = principal.organization_id
    if organization_id is None:
        raise CaseNotFoundError
    set_tenant(session, TenantContext(organization_id, principal.user_id))
    # El candado compartido evita atribuir a una alteración un evento que entra mientras
    # se leen los eventos. Las escrituras de custodia actualizan la fila del caso.
    case = cases_repository.case_for_member_read_lock(session, case_id, principal.user_id)
    if case is None or case.organization_id != organization_id:
        raise CaseNotFoundError

    return custody_chain.verify(
        custody_chain.load(session, case_id), expected_count=case.custody_seq
    )
