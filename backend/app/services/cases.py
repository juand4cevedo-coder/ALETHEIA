"""Casos: abrir uno, ver su detalle y listar los de cada persona (RF-020, HU-015 y HU-017).

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

La lista trae solo los casos donde la persona es miembro, aunque sea propietaria o
administradora de la organización. Pagina por cursor sobre (última actividad, id): el cursor es
ese par en JSON y base64url, sin firma, porque no da acceso a nada que el filtro por miembro no
permita ya; uno que no se puede leer es InvalidCursorError.
"""

import base64
import binascii
import datetime
import json
import uuid
from dataclasses import dataclass
from typing import Final, Literal

from psycopg import errors as pg_errors
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.adapters.keys import KeyWrapper
from app.core.case_keys import new_wrapped_case_key
from app.core.permissions import has_permission
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Case, CaseMember, CustodyEvent
from app.repositories import cases as cases_repository
from app.repositories.cases import CaseMemberView, CustodyEventView
from app.services.audit import audit_ip, audit_user_agent
from app.services.custody_chain import GENESIS_HASH
from app.services.members import OrganizationNotActiveError
from app.services.sessions import Principal

CASE_CREATED: Final = "case_created"
# Eventos de la cadena que trae el detalle del caso.
RECENT_EVENTS: Final = 20
# Acciones de la cadena que trae cada caso de la lista.
RECENT_ACTIONS: Final = 5
# Iniciales del equipo que trae cada caso de la lista.
MEMBER_INITIALS: Final = 3
# Estados que muestra cada filtro de la lista; un caso en eliminación no aparece en ninguno.
STATUS_FILTERS: Final[dict[str, tuple[str, ...]]] = {
    "open": ("open",),
    "closed": ("closed",),
    "all": ("open", "closed"),
}
_FILING_NUMBER_INDEX: Final = "uq_cases_organization_filing_number"


class NotAllowedToCreateCasesError(Exception):
    """El rol no abre casos (RN-008), o la persona ya no pertenece a ninguna organización."""


class EmailNotVerifiedError(Exception):
    """La persona no ha verificado su correo (CA-HU-006-02)."""


class FilingNumberTakenError(Exception):
    """La organización ya tiene un caso con ese radicado."""


class CaseNotFoundError(Exception):
    """El caso no existe o la persona no es miembro de él (MSG-011)."""


class InvalidCursorError(Exception):
    """El cursor de la lista no salió de una página anterior: está alterado o incompleto."""


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


@dataclass(frozen=True)
class LastEvent:
    """El último evento de la cadena de un caso."""

    action: str
    # None en los eventos del sistema, como el sellado de tiempo.
    actor_name: str | None
    occurred_at: datetime.datetime


@dataclass(frozen=True)
class CaseSummary:
    """Un caso de la lista con su actividad."""

    id: uuid.UUID
    title: str
    filing_number: str | None
    court: str | None
    practice_area: str | None
    internal_reference: str | None
    status: str
    created_at: datetime.datetime
    created_by_name: str
    member_count: int
    evidence_count: int
    # Solo los tipos declarados que tienen alguna evidencia.
    evidence_by_type: dict[str, int]
    # Las de las tres primeras personas en llegar al caso.
    member_initials: list[str]
    # None solo si el caso no tiene eventos, lo que no debería ocurrir.
    last_event: LastEvent | None
    # Las de los últimos cinco eventos, el más reciente al final.
    recent_actions: list[str]
    last_activity_at: datetime.datetime


@dataclass(frozen=True)
class CaseTotals:
    """Totales de los casos de la persona, sin importar el filtro ni la página."""

    open: int
    closed: int
    evidences: int
    pending_stamps: int
    custody_events: int


@dataclass(frozen=True)
class CaseListing:
    """Una página de la lista, el cursor de la siguiente y los totales."""

    items: list[CaseSummary]
    next_cursor: str | None
    totals: CaseTotals


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
    if organization_id is None or not has_permission(principal.role, "cases.create"):
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
            if not has_permission(role, "cases.create"):
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


def list_cases(
    session: Session,
    principal: Principal,
    *,
    status: Literal["open", "closed", "all"],
    cursor: str | None,
    limit: int,
) -> CaseListing:
    """Los casos donde la persona es miembro, de la actividad más reciente a la más antigua.

    Son dos consultas sin importar cuántos casos haya: la página y los totales.
    """
    after = _decode_cursor(cursor) if cursor is not None else None
    organization_id = principal.organization_id
    if organization_id is None:
        # Quien ya no pertenece a una organización no es miembro de ningún caso.
        return CaseListing(items=[], next_cursor=None, totals=CaseTotals(0, 0, 0, 0, 0))
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))
    # Se pide uno de más para saber si hay otra página sin una consulta adicional.
    rows = cases_repository.member_cases(
        session,
        organization_id,
        principal.user_id,
        statuses=STATUS_FILTERS[status],
        after=after,
        limit=limit + 1,
        recent_actions=RECENT_ACTIONS,
    )
    totals = cases_repository.member_case_totals(
        session, organization_id, principal.user_id, statuses=STATUS_FILTERS["all"]
    )
    page = [_case_summary(row) for row in rows[:limit]]
    last = page[-1] if page else None
    return CaseListing(
        items=page,
        next_cursor=(
            _encode_cursor(last.last_activity_at, last.id)
            if last is not None and len(rows) > limit
            else None
        ),
        totals=CaseTotals(
            open=totals.open,
            closed=totals.closed,
            evidences=totals.evidences,
            pending_stamps=totals.pending_stamps,
            custody_events=totals.custody_events,
        ),
    )


def initials(full_name: str) -> str:
    """La inicial del primer nombre y la de la última palabra: «Ana María Restrepo» es «AR»."""
    words = full_name.split()
    if not words:
        return ""
    if len(words) == 1:
        return words[0][0].upper()
    return (words[0][0] + words[-1][0]).upper()


def _case_summary(row: cases_repository.CaseActivityRow) -> CaseSummary:
    case = row.case
    last_event = (
        LastEvent(
            action=row.last_action,
            actor_name=row.last_actor_name,
            occurred_at=row.last_occurred_at,
        )
        if row.last_action is not None and row.last_occurred_at is not None
        else None
    )
    return CaseSummary(
        id=case.id,
        title=case.title,
        filing_number=case.filing_number,
        court=case.court,
        practice_area=case.practice_area,
        internal_reference=case.internal_reference,
        status=case.status,
        created_at=case.created_at,
        created_by_name=row.created_by_name,
        member_count=row.member_count,
        evidence_count=sum(row.evidence_by_type.values()),
        evidence_by_type=row.evidence_by_type,
        member_initials=[initials(name) for name in row.member_names[:MEMBER_INITIALS]],
        last_event=last_event,
        recent_actions=row.recent_actions,
        last_activity_at=row.last_activity_at,
    )


def _encode_cursor(last_activity_at: datetime.datetime, case_id: uuid.UUID) -> str:
    payload = json.dumps(
        {"at": last_activity_at.isoformat(), "id": str(case_id)}, separators=(",", ":")
    )
    return base64.urlsafe_b64encode(payload.encode()).rstrip(b"=").decode()


def _decode_cursor(cursor: str) -> tuple[datetime.datetime, uuid.UUID]:
    """El par (última actividad, id) del cursor, o InvalidCursorError si no se puede leer."""
    try:
        raw = base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
        data = json.loads(raw.decode())
        if not isinstance(data, dict) or set(data) != {"at", "id"}:
            raise InvalidCursorError
        at, case_id = data["at"], data["id"]
        if not isinstance(at, str) or not isinstance(case_id, str):
            raise InvalidCursorError
        last_activity_at = datetime.datetime.fromisoformat(at)
        # Una hora sin zona no salió de este servidor.
        if last_activity_at.utcoffset() is None:
            raise InvalidCursorError
        return last_activity_at, uuid.UUID(case_id)
    except (binascii.Error, ValueError) as exc:
        # json.JSONDecodeError y UnicodeDecodeError también son ValueError.
        raise InvalidCursorError from exc


def _is_filing_number_taken(exc: IntegrityError) -> bool:
    # Solo el índice del radicado: cualquier otra violación de integridad es un error real.
    orig = exc.orig
    return (
        isinstance(orig, pg_errors.UniqueViolation)
        and orig.diag.constraint_name == _FILING_NUMBER_INDEX
    )
