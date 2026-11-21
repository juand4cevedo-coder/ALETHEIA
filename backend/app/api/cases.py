"""Casos: abrir uno, listar los de cada persona y ver su detalle (API-022 a API-024, HU-015 y
HU-017).

Abrir un caso lo pueden hacer el propietario, el administrador y el abogado (RN-008); el
servicio lo comprueba y esta capa traduce sus errores. Las respuestas llevan datos de un
expediente, así que ningún intermediario guarda una copia, tampoco las de error.
"""

import logging
import uuid
from typing import Annotated, Any, Final, Literal
from urllib.parse import quote

import tink
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.evidence_storage import new_evidence_sink
from app.adapters.keys import KeyWrapper, KeyWrapperError
from app.api import API_PREFIX
from app.api.deps import (
    NOT_ALLOWED,
    get_app_settings,
    get_client_ip,
    get_key_wrapper,
    get_principal,
    get_principal_allowing_outdated_legal,
    get_session,
)
from app.api.organization import NOT_FOUND
from app.core.config import Settings
from app.core.errors import UNEXPECTED_ERROR, problem_response
from app.models import User
from app.schemas.cases import (
    INVALID_FILING_NUMBER,
    CaseCandidate,
    CaseCreate,
    CaseDetail,
    CaseMemberAdd,
    CaseMemberOut,
    CaseOut,
    CasePage,
    CaseSummaryOut,
    CaseTotalsOut,
    CustodyEventOut,
    CustodyPage,
    CustodyVerificationOut,
    EvidenceDetailOut,
    EvidencePage,
    EvidenceSummaryOut,
    EvidenceUploadOut,
    LastEventOut,
)
from app.services import cases as cases_service
from app.services import custody_verification, evidence_queries, rate_limit
from app.services import evidence_download as evidence_download_service
from app.services import evidence_upload as evidence_service
from app.services.evidence_stream import FileTooLarge, InvalidUpload
from app.services.members import OrganizationNotActiveError
from app.services.sessions import Principal

logger = logging.getLogger(__name__)


def get_case_worker(
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> Principal:
    return _case_worker(principal, session)


def get_case_worker_for_download(
    principal: Annotated[Principal, Depends(get_principal_allowing_outdated_legal)],
    session: Annotated[Session, Depends(get_session)],
) -> Principal:
    return _case_worker(principal, session)


def _case_worker(principal: Principal, session: Session) -> Principal:
    """La cuenta propietaria de la plataforma administra el servicio, no expedientes."""
    if session.scalar(select(User.is_platform_admin).where(User.id == principal.user_id)) is True:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="La cuenta propietaria administra la plataforma y no trabaja en casos.",
            headers={"Cache-Control": "no-store"},
        )
    return principal


router = APIRouter(prefix="/cases", tags=["casos"], dependencies=[Depends(get_case_worker)])
download_router = APIRouter(
    prefix="/cases", tags=["casos"], dependencies=[Depends(get_case_worker_for_download)]
)

EMAIL_NOT_VERIFIED: Final = (
    "Verifique su correo para abrir casos. Le enviamos un enlace al crear la cuenta; si "
    "venció, pida uno nuevo"
)
FILING_NUMBER_TAKEN: Final = "Ya hay un caso con este número de radicación en su organización"
# Tipo de Problem Details del 409 por radicado repetido. Es un identificador, no una página: la
# interfaz lo compara tal cual para distinguirlo del 409 de solo lectura y señalar el campo.
FILING_NUMBER_TAKEN_PROBLEM: Final = "https://aletheia.sbs/problemas/radicado-repetido"
KEYS_UNAVAILABLE: Final = (
    "No pudimos preparar la llave de cifrado del caso. Inténtelo de nuevo en unos minutos"
)
INVALID_CURSOR: Final = (
    "No pudimos continuar la lista desde ese punto. Vuelva a cargarla desde el principio"
)
# Casos por página de la lista: 25 por defecto y como máximo 50.
CASE_PAGE_SIZE_DEFAULT: Final = 25
CASE_PAGE_SIZE_MAX: Final = 50
ORGANIZATION_NOT_ACTIVE: Final = (
    "Su organización está en solo lectura: puede consultar y exportar, pero no abrir casos "
    "hasta reactivar el plan."
)

# Las respuestas de error también llevan datos del expediente: se escriben en la excepción
# porque las cabeceras de la respuesta normal no pasan a la de error.
_NO_STORE: Final = {"Cache-Control": "no-store"}
# Segundos que se sugiere esperar antes de reintentar cuando KMS no responde.
_KMS_RETRY_SECONDS: Final = "30"

type _Responses = dict[int | str, dict[str, Any]]

_UNAUTHORIZED: Final[_Responses] = {
    status.HTTP_401_UNAUTHORIZED: {"description": "No hay una sesión válida."}
}


@router.get(
    "/{case_id}/custody-events",
    response_model=CustodyPage,
    summary="Consultar la cadena de custodia de un caso asignado",
    responses=_UNAUTHORIZED
    | {404: {"description": "El caso no existe o la persona no pertenece a él."}},
)
def list_custody_events(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    cursor: Annotated[int | None, Query(ge=1)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> CustodyPage:
    response.headers["Cache-Control"] = "no-store"
    try:
        events, next_cursor = evidence_queries.list_case_events(
            session, principal, case_id, cursor=cursor, limit=limit
        )
    except cases_service.CaseNotFoundError:
        raise HTTPException(404, detail=NOT_FOUND, headers=_NO_STORE) from None
    return CustodyPage(
        items=[
            CustodyEventOut(
                seq=event.seq,
                action=event.action,
                actor_name=event.actor_name,
                occurred_at=event.occurred_at,
                event_hash=event.event_hash.hex(),
            )
            for event in events
        ],
        next_cursor=next_cursor,
    )


@router.get(
    "/{case_id}/custody-verification",
    response_model=CustodyVerificationOut,
    summary="Recalcular y verificar la cadena de custodia de un caso asignado",
    responses=_UNAUTHORIZED
    | {404: {"description": "El caso no existe o la persona no pertenece a él."}},
)
def verify_custody(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> CustodyVerificationOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        report = custody_verification.verify_case(session, principal, case_id)
    except cases_service.CaseNotFoundError:
        raise HTTPException(404, detail=NOT_FOUND, headers=_NO_STORE) from None
    return CustodyVerificationOut(
        intact=report.intact,
        events_checked=report.events_checked,
        broken_at=report.broken_at,
        reason=report.reason,
        head_hash=report.head_hash.hex(),
    )


@router.get(
    "/{case_id}/evidences",
    response_model=EvidencePage,
    summary="Consultar las evidencias de un caso asignado",
    responses=_UNAUTHORIZED
    | {404: {"description": "El caso no existe o la persona no pertenece a él."}},
)
def list_evidences(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    cursor: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> EvidencePage:
    response.headers["Cache-Control"] = "no-store"
    try:
        rows, next_cursor = evidence_queries.list_evidences(
            session, principal, case_id, cursor=cursor, limit=limit
        )
    except cases_service.CaseNotFoundError:
        raise HTTPException(404, detail=NOT_FOUND, headers=_NO_STORE) from None
    return EvidencePage(
        items=[
            EvidenceSummaryOut.model_validate(
                {
                    "id": row.id,
                    "original_filename": row.original_filename,
                    "declared_type": row.declared_type,
                    "declared_origin": row.declared_origin,
                    "detected_type": row.detected_type,
                    "sha256": row.sha256.hex(),
                    "size_bytes": row.size_bytes,
                    "tsa_status": row.tsa_status,
                    "uploaded_at": row.uploaded_at,
                }
            )
            for row in rows
        ],
        next_cursor=next_cursor,
    )


@router.get(
    "/{case_id}/evidences/{evidence_id}",
    response_model=EvidenceDetailOut,
    summary="Ver los metadatos, sello y eventos de una evidencia asignada",
    responses=_UNAUTHORIZED
    | {404: {"description": "El caso o la evidencia no existen para esta persona."}},
)
def read_evidence(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    event_cursor: Annotated[int | None, Query(ge=1)] = None,
) -> EvidenceDetailOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        evidence, events, next_event_seq = evidence_queries.get_evidence(
            session, principal, case_id, evidence_id, event_cursor=event_cursor
        )
    except cases_service.CaseNotFoundError:
        raise HTTPException(404, detail=NOT_FOUND, headers=_NO_STORE) from None
    return EvidenceDetailOut.model_validate(
        {
            "id": evidence.id,
            "original_filename": evidence.original_filename,
            "declared_type": evidence.declared_type,
            "declared_origin": evidence.declared_origin,
            "detected_type": evidence.detected_type,
            "sha256": evidence.sha256.hex(),
            "size_bytes": evidence.size_bytes,
            "tsa_status": evidence.tsa_status,
            "tsa_time": evidence.tsa_time,
            "uploaded_at": evidence.uploaded_at,
            "events": [
                CustodyEventOut(
                    seq=event.seq,
                    action=event.action,
                    actor_name=event.actor_name,
                    occurred_at=event.occurred_at,
                    event_hash=event.event_hash.hex(),
                )
                for event in events
            ],
            "next_event_seq": next_event_seq,
        }
    )


@download_router.get(
    "/{case_id}/evidences/{evidence_id}/download",
    summary="Descargar el archivo original verificado",
    responses=_UNAUTHORIZED
    | {
        200: {
            "description": "Archivo original; su descarga queda en la cadena de custodia.",
            "content": {
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}}
            },
        },
        403: {"description": "El miembro del caso no puede descargar originales."},
        404: {"description": "El caso o la evidencia no existen para esta persona."},
        503: {"description": "No se pudo verificar o leer el archivo conservado."},
    },
)
def download_evidence(
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    principal: Annotated[Principal, Depends(get_principal_allowing_outdated_legal)],
    session: Annotated[Session, Depends(get_session)],
    wrapper: Annotated[KeyWrapper, Depends(get_key_wrapper)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> StreamingResponse:
    try:
        download = evidence_download_service.prepare_download(
            session, principal, case_id, evidence_id, wrapper, settings
        )
    except cases_service.CaseNotFoundError:
        raise HTTPException(404, detail=NOT_FOUND, headers=_NO_STORE) from None
    except evidence_download_service.DownloadForbidden:
        raise HTTPException(403, detail=NOT_ALLOWED, headers=_NO_STORE) from None
    except (
        KeyWrapperError,
        BotoCoreError,
        ClientError,
        OSError,
        ValueError,
        tink.TinkError,
        evidence_download_service.EvidenceIntegrityError,
    ):
        logger.exception("No se pudo verificar una evidencia antes de descargarla")
        raise HTTPException(
            503, detail="No se pudo verificar el archivo conservado.", headers=_NO_STORE
        ) from None
    return StreamingResponse(
        download.chunks(),
        media_type="application/octet-stream",
        headers={
            "Cache-Control": "no-store",
            "Content-Length": str(download.size_bytes),
            "Content-Disposition": (
                f"attachment; filename*=UTF-8''{quote(download.filename, safe='')}"
            ),
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/{case_id}/evidences",
    status_code=status.HTTP_201_CREATED,
    response_model=EvidenceUploadOut,
    summary="Preservar un archivo de evidencia cifrado",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["tipo", "origen", "archivo"],
                        "properties": {
                            "tipo": {
                                "type": "string",
                                "enum": ["chat", "email", "audio", "image", "document", "other"],
                            },
                            "origen": {"type": "string", "minLength": 1, "maxLength": 500},
                            "archivo": {"type": "string", "format": "binary"},
                        },
                        "description": "Enviar tipo y origen antes del archivo.",
                    }
                }
            },
        }
    },
    responses=_UNAUTHORIZED
    | {
        403: {"description": "La persona no está asignada al caso o carece del permiso."},
        409: {"description": "El caso o el despacho no admiten nuevas evidencias."},
        413: {"description": "El archivo supera el tope del plan o la cuota disponible."},
        422: {"description": "Formulario inválido; tipo y origen deben preceder al archivo."},
        429: {"description": "Demasiadas subidas de esta cuenta; reintentar más tarde."},
        503: {"description": "No se pudo acceder a la llave de cifrado del caso."},
    },
)
def upload_evidence(
    case_id: uuid.UUID,
    request: Request,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    wrapper: Annotated[KeyWrapper, Depends(get_key_wrapper)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> EvidenceUploadOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        rate_limit.hit(session, rate_limit.UPLOAD_ACCOUNT, str(principal.user_id))
        session.commit()
    except rate_limit.RateLimitExceededError as exc:
        raise HTTPException(
            429,
            detail="Demasiadas subidas; reintente más tarde.",
            headers=_NO_STORE | {"Retry-After": str(exc.retry_after)},
        ) from None
    evidence_id = uuid.uuid7()
    storage_key = f"evidences/{evidence_id}"
    sink = new_evidence_sink(settings, storage_key)
    try:
        received = evidence_service.upload(
            session, principal, case_id, request, wrapper, sink, evidence_id, storage_key
        )
    except evidence_service.UploadForbidden:
        raise HTTPException(403, detail=NOT_ALLOWED, headers=_NO_STORE) from None
    except evidence_service.UploadUnavailable:
        raise HTTPException(
            409, detail="El caso o el despacho no admiten nuevas evidencias.", headers=_NO_STORE
        ) from None
    except evidence_service.QuotaExceeded, FileTooLarge:
        raise HTTPException(
            413, detail="El archivo supera el límite disponible.", headers=_NO_STORE
        ) from None
    except InvalidUpload, UnicodeError, ValueError:
        raise HTTPException(
            422, detail="Formulario de evidencia inválido.", headers=_NO_STORE
        ) from None
    except KeyWrapperError as exc:
        logger.error("No se pudo abrir la llave del caso: %s", exc)
        raise HTTPException(
            503, detail=KEYS_UNAVAILABLE, headers=_NO_STORE | {"Retry-After": _KMS_RETRY_SECONDS}
        ) from None
    return EvidenceUploadOut(
        id=evidence_id,
        sha256=received.sha256.hex(),
        size_bytes=received.size,
        tsa_status="pending",
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=CaseOut,
    summary="Abrir un caso",
    responses=_UNAUTHORIZED
    | {
        status.HTTP_403_FORBIDDEN: {
            "description": "El rol no abre casos o la persona no ha verificado su correo."
        },
        status.HTTP_409_CONFLICT: {
            "description": (
                "La organización está en solo lectura o ya hay un caso con ese radicado "
                f"(tipo {FILING_NUMBER_TAKEN_PROBLEM})."
            )
        },
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": f"Datos inválidos, por ejemplo: {INVALID_FILING_NUMBER}."
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "KMS no respondió y no se pudo preparar la llave del caso."
        },
    },
)
def create_case(
    data: CaseCreate,
    request: Request,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    wrapper: Annotated[KeyWrapper, Depends(get_key_wrapper)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> CaseOut | JSONResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        case = cases_service.create_case(
            session,
            principal,
            cases_service.NewCase(
                title=data.title,
                filing_number=data.filing_number,
                court=data.court,
                practice_area=data.practice_area,
                internal_reference=data.internal_reference,
            ),
            wrapper,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        # El caso quedó expirado al confirmar: se lee ahora, con la sesión abierta y el
        # contexto de la organización puesto, no al serializar la respuesta.
        view = cases_service.get_case(session, principal, case.id)
    except cases_service.NotAllowedToCreateCasesError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail=NOT_ALLOWED, headers=_NO_STORE
        ) from None
    except cases_service.EmailNotVerifiedError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail=EMAIL_NOT_VERIFIED, headers=_NO_STORE
        ) from None
    except OrganizationNotActiveError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=ORGANIZATION_NOT_ACTIVE, headers=_NO_STORE
        ) from None
    except cases_service.FilingNumberTakenError:
        # Un 409 con su propio tipo: comparte código con el de solo lectura.
        return problem_response(
            request,
            status.HTTP_409_CONFLICT,
            detail=FILING_NUMBER_TAKEN,
            headers=_NO_STORE,
            problem_type=FILING_NUMBER_TAKEN_PROBLEM,
        )
    except KeyWrapperError as exc:
        # El mensaje solo nombra el código de error de KMS o el tipo de la excepción, nunca la
        # llave: se puede registrar tal cual.
        logger.error("No se pudo envolver la llave del caso: %s", exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=KEYS_UNAVAILABLE,
            headers=_NO_STORE | {"Retry-After": _KMS_RETRY_SECONDS},
        ) from None
    except cases_service.CaseNotFoundError:
        # El caso se acaba de crear: no encontrarlo es un error del servidor, no un 404.
        logger.error("El caso recién abierto no se pudo leer")
        return problem_response(
            request,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=UNEXPECTED_ERROR,
            headers=_NO_STORE,
        )
    response.headers["Location"] = f"{API_PREFIX}{router.prefix}/{view.case.id}"
    return _case_out(view)


@router.get(
    "",
    summary="Listar los casos donde la persona es miembro, con su actividad",
    responses=_UNAUTHORIZED
    | {
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "description": f"Parámetros inválidos, por ejemplo: {INVALID_CURSOR}."
        }
    },
)
def list_cases(
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    case_status: Annotated[
        Literal["open", "closed", "all"],
        Query(alias="status", description="Casos abiertos, cerrados o todos."),
    ] = "open",
    cursor: Annotated[
        str | None, Query(max_length=200, description="next_cursor de la página anterior.")
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=CASE_PAGE_SIZE_MAX, description="Casos por página.")
    ] = CASE_PAGE_SIZE_DEFAULT,
) -> CasePage:
    response.headers["Cache-Control"] = "no-store"
    try:
        listing = cases_service.list_cases(
            session, principal, status=case_status, cursor=cursor, limit=limit
        )
    except cases_service.InvalidCursorError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail=INVALID_CURSOR, headers=_NO_STORE
        ) from None
    totals = listing.totals
    return CasePage(
        items=[_case_summary_out(item) for item in listing.items],
        next_cursor=listing.next_cursor,
        totals=CaseTotalsOut(
            open=totals.open,
            closed=totals.closed,
            evidences=totals.evidences,
            pending_stamps=totals.pending_stamps,
            custody_events=totals.custody_events,
        ),
    )


@router.get(
    "/{case_id}",
    summary="Ver un caso con su equipo y su cadena de custodia",
    responses=_UNAUTHORIZED
    | {
        status.HTTP_404_NOT_FOUND: {
            "description": "El caso no existe o la persona no es miembro de él."
        }
    },
)
def read_case(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> CaseDetail:
    response.headers["Cache-Control"] = "no-store"
    try:
        view = cases_service.get_case(session, principal, case_id)
    except cases_service.CaseNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=NOT_FOUND, headers=_NO_STORE
        ) from None
    return CaseDetail(
        **_case_out(view).model_dump(),
        members=[
            CaseMemberOut.model_validate(
                {
                    "user_id": member.user_id,
                    "full_name": member.full_name,
                    "email": member.email,
                    "role": member.role,
                    "added_at": member.added_at,
                }
            )
            for member in view.members
        ],
        recent_events=[
            CustodyEventOut.model_validate(
                {
                    "seq": event.seq,
                    "action": event.action,
                    "actor_name": event.actor_name,
                    "occurred_at": event.occurred_at,
                    "event_hash": event.event_hash.hex(),
                }
            )
            for event in view.recent_events
        ],
    )


@router.post(
    "/{case_id}/close",
    response_model=CaseOut,
    summary="Cerrar y archivar un caso sin borrar sus datos",
    responses=_UNAUTHORIZED
    | {
        403: {"description": "El rol no administra el ciclo de vida del caso."},
        404: {"description": "El caso no existe o la persona no pertenece a él."},
        409: {"description": "El caso ya está cerrado o el despacho está en solo lectura."},
    },
)
def close_case(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> CaseOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        cases_service.close_case(
            session,
            principal,
            case_id,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        return _case_out(cases_service.get_case(session, principal, case_id))
    except cases_service.CaseNotFoundError:
        raise HTTPException(404, detail=NOT_FOUND, headers=_NO_STORE) from None
    except cases_service.NotAllowedToManageCaseError:
        raise HTTPException(403, detail=NOT_ALLOWED, headers=_NO_STORE) from None
    except cases_service.CaseAlreadyInStateError:
        raise HTTPException(409, detail="El caso ya está cerrado.", headers=_NO_STORE) from None
    except OrganizationNotActiveError:
        raise HTTPException(409, detail=ORGANIZATION_NOT_ACTIVE, headers=_NO_STORE) from None


@router.post(
    "/{case_id}/reopen",
    response_model=CaseOut,
    summary="Reabrir un caso conservando la historia de su archivo",
    responses=_UNAUTHORIZED
    | {
        403: {"description": "El rol no administra el ciclo de vida del caso."},
        404: {"description": "El caso no existe o la persona no pertenece a él."},
        409: {"description": "El caso ya está abierto o el despacho está en solo lectura."},
    },
)
def reopen_case(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> CaseOut:
    response.headers["Cache-Control"] = "no-store"
    try:
        cases_service.reopen_case(
            session,
            principal,
            case_id,
            client_ip=client_ip,
            user_agent=user_agent,
        )
        return _case_out(cases_service.get_case(session, principal, case_id))
    except cases_service.CaseNotFoundError:
        raise HTTPException(404, detail=NOT_FOUND, headers=_NO_STORE) from None
    except cases_service.NotAllowedToManageCaseError:
        raise HTTPException(403, detail=NOT_ALLOWED, headers=_NO_STORE) from None
    except cases_service.CaseAlreadyInStateError:
        raise HTTPException(409, detail="El caso ya está abierto.", headers=_NO_STORE) from None
    except OrganizationNotActiveError:
        raise HTTPException(409, detail=ORGANIZATION_NOT_ACTIVE, headers=_NO_STORE) from None


@router.get(
    "/{case_id}/available-members",
    summary="Personas disponibles para el equipo del caso",
    responses=_UNAUTHORIZED
    | {
        403: {"description": "El rol no administra este equipo."},
        404: {"description": "El caso no existe o la persona no pertenece a él."},
    },
)
def available_case_members(
    case_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> list[CaseCandidate]:
    response.headers["Cache-Control"] = "no-store"
    try:
        candidates = cases_service.available_case_members(session, principal, case_id)
    except cases_service.CaseNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=NOT_FOUND, headers=_NO_STORE
        ) from None
    except cases_service.NotAllowedToManageCaseError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail=NOT_ALLOWED, headers=_NO_STORE
        ) from None
    return [
        CaseCandidate.model_validate(candidate, from_attributes=True) for candidate in candidates
    ]


@router.post(
    "/{case_id}/members",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Asignar una persona al caso",
    responses=_UNAUTHORIZED
    | {
        403: {"description": "El rol no administra este equipo."},
        404: {"description": "El caso o la persona no pertenecen a este despacho."},
        409: {"description": "La persona ya está asignada o el despacho está en solo lectura."},
    },
)
def add_case_member(
    case_id: uuid.UUID,
    data: CaseMemberAdd,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> None:
    response.headers["Cache-Control"] = "no-store"
    try:
        cases_service.add_case_member(session, principal, case_id, data.user_id)
    except cases_service.CaseNotFoundError, cases_service.CaseMemberNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=NOT_FOUND, headers=_NO_STORE
        ) from None
    except cases_service.NotAllowedToManageCaseError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail=NOT_ALLOWED, headers=_NO_STORE
        ) from None
    except cases_service.CaseMemberAlreadyAssignedError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Esta persona ya pertenece al caso.", headers=_NO_STORE
        ) from None
    except OrganizationNotActiveError:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=ORGANIZATION_NOT_ACTIVE, headers=_NO_STORE
        ) from None


@router.delete(
    "/{case_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retirar una persona del caso",
    responses=_UNAUTHORIZED
    | {
        403: {"description": "El rol no administra este equipo o intenta retirarse a sí mismo."},
        404: {"description": "El caso o la asignación no existen para esta persona."},
    },
)
def remove_case_member(
    case_id: uuid.UUID,
    user_id: uuid.UUID,
    response: Response,
    principal: Annotated[Principal, Depends(get_principal)],
    session: Annotated[Session, Depends(get_session)],
) -> None:
    response.headers["Cache-Control"] = "no-store"
    try:
        cases_service.remove_case_member(session, principal, case_id, user_id)
    except cases_service.CaseNotFoundError, cases_service.CaseMemberNotFoundError:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=NOT_FOUND, headers=_NO_STORE
        ) from None
    except cases_service.NotAllowedToManageCaseError, cases_service.SelfRemovalError:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail=NOT_ALLOWED, headers=_NO_STORE
        ) from None


def _case_summary_out(item: cases_service.CaseSummary) -> CaseSummaryOut:
    last_event = item.last_event
    return CaseSummaryOut.model_validate(
        {
            "id": item.id,
            "title": item.title,
            "filing_number": item.filing_number,
            "court": item.court,
            "practice_area": item.practice_area,
            "internal_reference": item.internal_reference,
            "status": item.status,
            "created_at": item.created_at,
            "closed_at": item.closed_at,
            "retention_until": item.retention_until,
            "retention_basis": item.retention_basis,
            "legal_hold": item.legal_hold,
            "created_by_name": item.created_by_name,
            "member_count": item.member_count,
            "evidence_count": item.evidence_count,
            "evidence_by_type": item.evidence_by_type,
            "member_initials": item.member_initials,
            "last_event": (
                None
                if last_event is None
                else LastEventOut(
                    action=last_event.action,
                    actor_name=last_event.actor_name,
                    occurred_at=last_event.occurred_at,
                )
            ),
            "recent_actions": item.recent_actions,
            "last_activity_at": item.last_activity_at,
        }
    )


def _case_out(view: cases_service.CaseView) -> CaseOut:
    case = view.case
    return CaseOut.model_validate(
        {
            "id": case.id,
            "title": case.title,
            "filing_number": case.filing_number,
            "court": case.court,
            "practice_area": case.practice_area,
            "internal_reference": case.internal_reference,
            "status": case.status,
            "created_at": case.created_at,
            "closed_at": case.closed_at,
            "retention_until": case.retention_until,
            "retention_basis": case.retention_basis,
            "legal_hold": case.legal_hold,
            "created_by_name": view.created_by_name,
            "member_count": len(view.members),
        }
    )
