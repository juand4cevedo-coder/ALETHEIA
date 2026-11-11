"""Casos: abrir uno y ver su detalle (API-022 y API-024, HU-015).

Abrir un caso lo pueden hacer el propietario, el administrador y el abogado (RN-008); el
servicio lo comprueba y esta capa traduce sus errores. Las respuestas llevan datos de un
expediente, así que ningún intermediario guarda una copia, tampoco las de error.
"""

import logging
import uuid
from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.adapters.keys import KeyWrapper, KeyWrapperError
from app.api import API_PREFIX
from app.api.deps import NOT_ALLOWED, get_client_ip, get_key_wrapper, get_principal, get_session
from app.api.organization import NOT_FOUND
from app.core.errors import UNEXPECTED_ERROR, problem_response
from app.schemas.cases import (
    INVALID_FILING_NUMBER,
    CaseCreate,
    CaseDetail,
    CaseMemberOut,
    CaseOut,
    CustodyEventOut,
)
from app.services import cases as cases_service
from app.services.members import OrganizationNotActiveError
from app.services.sessions import Principal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cases", tags=["casos"])

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
            "created_by_name": view.created_by_name,
            "member_count": len(view.members),
        }
    )
