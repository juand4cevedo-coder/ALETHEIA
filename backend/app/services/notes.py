"""Notas internas de un caso: se agregan y se leen, nunca se editan ni se borran."""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import has_permission
from app.models import AuditLog, Case, CaseMember, CaseNote, User
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal
from app.services.tasks import (
    ClosedCaseTaskError,
    TaskCaseNotFoundError,
    TaskNotAllowedError,
    _active_organization,
    _member_case,
)

# Los errores se reutilizan de las tareas: es el mismo caso (no existe o no es de la persona) y
# la misma regla (un caso archivado queda en solo lectura).
CaseNotFoundError = TaskCaseNotFoundError
NoteNotAllowedError = TaskNotAllowedError
ClosedCaseNoteError = ClosedCaseTaskError


@dataclass(frozen=True, slots=True)
class NoteView:
    note: CaseNote
    author_name: str


def list_notes(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    *,
    cursor: uuid.UUID | None,
    limit: int,
) -> tuple[list[NoteView], uuid.UUID | None]:
    """Las notas más recientes primero. Las ve cualquiera que sea miembro del caso."""
    _member_case(session, principal, case_id, lock=False)
    query = (
        select(CaseNote, User.full_name)
        .join(User, User.id == CaseNote.author_id)
        .where(CaseNote.case_id == case_id)
        .order_by(CaseNote.id.desc())
        .limit(limit + 1)
    )
    if cursor is not None:
        query = query.where(CaseNote.id < cursor)
    rows = session.execute(query).all()
    page = rows[:limit]
    next_cursor = page[-1][0].id if len(rows) > limit else None
    return [NoteView(note, name) for note, name in page], next_cursor


def create_note(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    body: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> NoteView:
    """Agrega una nota y deja constancia en la auditoría. El texto no entra a la auditoría: solo
    el caso y el tamaño, para que el registro de seguridad no copie contenido del expediente."""
    if not has_permission(principal.role, "cases.write_notes"):
        raise NoteNotAllowedError
    session.commit()
    with session.begin():
        case: Case = _member_case(session, principal, case_id, lock=True)
        _active_organization(session, case.organization_id)
        if case.status != "open":
            raise ClosedCaseNoteError
        author = session.scalar(
            select(User.full_name)
            .join(CaseMember, CaseMember.user_id == User.id)
            .where(CaseMember.case_id == case.id, User.id == principal.user_id)
        )
        note = CaseNote(
            organization_id=case.organization_id,
            case_id=case.id,
            author_id=principal.user_id,
            body=body.strip(),
        )
        session.add(note)
        session.flush()
        session.add(
            AuditLog(
                organization_id=case.organization_id,
                actor_user_id=principal.user_id,
                action="case_note_created",
                target_id=note.id,
                details={"case_id": str(case.id), "length": len(note.body)},
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
            )
        )
        session.flush()
    return NoteView(note, author or "")
