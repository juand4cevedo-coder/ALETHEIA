"""Casos: abrir uno y ver su detalle (RF-020, HU-015).

Abrir un caso deja, en una sola transacción y bajo Row-Level Security, el caso con su llave
envuelta, la membresía de quien lo abre, el primer evento de su cadena de custodia
(case_created) y su entrada en la auditoría. O quedan las cuatro filas o no queda ninguna.

La llave se genera y se envuelve antes de abrir esa transacción: envolverla es una llamada de
red a KMS, y ninguna llamada de red ocurre con una transacción abierta (lección de TT-017). La
llave en claro solo existe en memoria dentro de new_wrapped_case_key.

El evento case_created solo lleva la versión de la llave maestra. El título y los datos
procesales no entran en la cadena: la cadena es inmutable y un dato personal escrito en ella no
se podría corregir ni eliminar (sección 3.2 del diseño).

Un caso que no existe y uno del que la persona no es miembro dan el mismo CaseNotFoundError, que
no revela cuál de los dos es (MSG-011).
"""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final

from psycopg import errors as pg_errors
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.adapters.keys import KeyWrapper
from app.core.case_keys import new_wrapped_case_key
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Case, CaseMember, CustodyEvent
from app.repositories import cases as cases_repository
from app.repositories.cases import CaseMemberView, CustodyEventView
from app.services.audit import audit_ip, audit_user_agent
from app.services.custody_chain import GENESIS_HASH
from app.services.members import OrganizationNotActiveError
from app.services.sessions import Principal

CASE_CREATORS: Final = frozenset({"owner", "admin", "lawyer"})
CASE_CREATED: Final = "case_created"
# Eventos de la cadena que trae el detalle del caso.
RECENT_EVENTS: Final = 20
_FILING_NUMBER_INDEX: Final = "uq_cases_organization_filing_number"


class NotAllowedToCreateCasesError(Exception):
    """El rol no abre casos (RN-008), o la persona ya no pertenece a ninguna organización."""


class EmailNotVerifiedError(Exception):
    """La persona no ha verificado su correo (CA-HU-006-02)."""


class FilingNumberTakenError(Exception):
    """La organización ya tiene un caso con ese radicado."""


class CaseNotFoundError(Exception):
    """El caso no existe o la persona no es miembro de él (MSG-011)."""


@dataclass(frozen=True)
class NewCase:
    """Datos con que se abre un caso, ya validados por la API."""

    title: str
    # Solo los 23 dígitos, sin separadores.
    filing_number: str | None
    court: str | None
    practice_area: str | None
    internal_reference: str | None


@dataclass(frozen=True)
class CaseView:
    """El caso, su equipo y sus últimos eventos, del más reciente al más antiguo."""

    case: Case
    # Quien abrió el caso, aunque ya no esté en su equipo.
    created_by_name: str
    members: list[CaseMemberView]
    recent_events: list[CustodyEventView]


def create_case(
    session: Session,
    principal: Principal,
    data: NewCase,
    wrapper: KeyWrapper,
    *,
    client_ip: str,
    user_agent: str | None,
) -> Case:
    """Abre un caso (API-022, CA-HU-015-01).

    Si KMS falla, KeyWrapperError se propaga sin que se haya abierto la transacción de escritura.
    El rol y el estado de la organización se comprueban antes de llamar a KMS y otra vez dentro
    de la transacción de escritura, por si cambiaron mientras tanto.
    """
    organization_id = principal.organization_id
    if organization_id is None or principal.role not in CASE_CREATORS:
        raise NotAllowedToCreateCasesError
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))

    # 1. Comprobaciones en una lectura corta que se cierra antes de llamar a KMS. Se confirma
    #    en lugar de deshacerse: no escribe nada, y deshacer descartaría lo que la petición
    #    ya hubiera dejado pendiente en la sesión.
    try:
        state = cases_repository.creator_state(session, principal.user_id, organization_id)
    except BaseException:
        session.rollback()
        raise
    session.commit()
    if not state.email_verified:
        raise EmailNotVerifiedError
    if state.organization_status != "active":
        raise OrganizationNotActiveError

    # 2. La llave, sin ninguna transacción abierta.
    wrapped = new_wrapped_case_key(wrapper)

    # 3. Las cuatro filas en una sola transacción.
    now = datetime.datetime.now(datetime.UTC)
    case = Case(
        # Se fija aquí, no al insertar: las otras tres filas lo necesitan.
        id=uuid.uuid7(),
        organization_id=organization_id,
        title=data.title,
        internal_reference=data.internal_reference,
        filing_number=data.filing_number,
        court=data.court,
        practice_area=data.practice_area,
        wrapped_key=wrapped.ciphertext,
        key_version=wrapped.key_version,
        created_by=principal.user_id,
    )
    try:
        with session.begin():
            # El contexto se aplica al empezar la transacción (after_begin); se fija de nuevo
            # por si alguien lo cambió en la sesión entre tanto.
            set_tenant(
                session,
                TenantContext(organization_id=organization_id, user_id=principal.user_id),
            )
            # El rol y el estado pudieron cambiar mientras KMS envolvía la llave: se leen otra
            # vez, bloqueados hasta el commit, para que un cambio no se cruce con la escritura.
            role, organization_status = cases_repository.creator_role_for_share(
                session, principal.user_id, organization_id
            )
            if role not in CASE_CREATORS:
                raise NotAllowedToCreateCasesError
            if organization_status != "active":
                raise OrganizationNotActiveError
            cases_repository.add_case(
                session,
                case=case,
                member=CaseMember(
                    case_id=case.id,
                    user_id=principal.user_id,
                    organization_id=organization_id,
                    added_by=principal.user_id,
                ),
                event=CustodyEvent(
                    organization_id=organization_id,
                    case_id=case.id,
                    # El trigger custody_events_chain comprueba el orden y calcula event_hash.
                    seq=1,
                    actor_user_id=principal.user_id,
                    action=CASE_CREATED,
                    details={"key_version": wrapped.key_version},
                    occurred_at=now,
                    prev_hash=GENESIS_HASH,
                ),
                audit=AuditLog(
                    organization_id=organization_id,
                    actor_user_id=principal.user_id,
                    action=CASE_CREATED,
                    target_id=case.id,
                    ip=audit_ip(client_ip),
                    user_agent=audit_user_agent(user_agent),
                    created_at=now,
                ),
            )
    except IntegrityError as exc:
        if _is_filing_number_taken(exc):
            raise FilingNumberTakenError from exc
        raise
    return case


def get_case(session: Session, principal: Principal, case_id: uuid.UUID) -> CaseView:
    """El caso con su equipo y sus últimos eventos (API-024)."""
    organization_id = principal.organization_id
    if organization_id is None:
        raise CaseNotFoundError
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))
    case = cases_repository.case_for_member(session, case_id, principal.user_id)
    if case is None or case.organization_id != organization_id:
        raise CaseNotFoundError
    return CaseView(
        case=case,
        created_by_name=cases_repository.user_name(session, case.created_by),
        members=cases_repository.case_members(session, organization_id, case.id),
        recent_events=cases_repository.recent_events(session, case.id, RECENT_EVENTS),
    )


def _is_filing_number_taken(exc: IntegrityError) -> bool:
    # Solo el índice del radicado: cualquier otra violación de integridad es un error real.
    orig = exc.orig
    return (
        isinstance(orig, pg_errors.UniqueViolation)
        and orig.diag.constraint_name == _FILING_NUMBER_INDEX
    )
