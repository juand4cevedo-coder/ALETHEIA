"""Notas internas de un caso."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.cases import get_case_worker
from app.api.deps import get_client_ip, get_principal, get_session
from app.schemas.notes import CaseNoteCreate, CaseNoteOut, CaseNotePage
from app.services import notes as note_service
from app.services.members import OrganizationNotActiveError
from app.services.sessions import Principal

router = APIRouter(prefix="/cases", tags=["notas"], dependencies=[Depends(get_case_worker)])

_NOT_FOUND = "No encontramos lo que busca o no tiene acceso a ello."


def _out(view: note_service.NoteView) -> CaseNoteOut:
    note = view.note
    return CaseNoteOut(
        id=note.id,
        case_id=note.case_id,
        author_id=note.author_id,
        author_name=view.author_name,
        body=note.body,
        created_at=note.created_at,
    )


@router.get("/{case_id}/notes", summary="Listar las notas de un caso")
def list_case_notes(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    cursor: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> CaseNotePage:
    response.headers["Cache-Control"] = "no-store"
    try:
        items, next_cursor = note_service.list_notes(
            session, principal, case_id, cursor=cursor, limit=limit
        )
    except note_service.CaseNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    return CaseNotePage(items=[_out(item) for item in items], next_cursor=next_cursor)


@router.post(
    "/{case_id}/notes",
    status_code=status.HTTP_201_CREATED,
    summary="Agregar una nota al caso",
)
def create_case_note(
    case_id: uuid.UUID,
    data: CaseNoteCreate,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> CaseNoteOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        view = note_service.create_note(
            session,
            principal,
            case_id,
            data.body,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except note_service.CaseNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND) from None
    except note_service.NoteNotAllowedError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="No tiene permiso para esta acción."
        ) from None
    except note_service.ClosedCaseNoteError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Un caso archivado conserva sus notas, pero no admite nuevas.",
        ) from None
    except OrganizationNotActiveError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="La organización no está activa."
        ) from None
    return _out(view)
