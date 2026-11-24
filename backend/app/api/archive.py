"""Banco de datos: cifras e índice del archivo de casos cerrados (lectura)."""

import datetime
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.cases import _archive_boundary, get_case_worker
from app.api.deps import get_client_ip, get_session
from app.schemas.cases import (
    ArchiveAreaOut,
    ArchiveBasisOut,
    ArchiveSummaryOut,
    ArchiveYearOut,
    PracticeArea,
)
from app.services import archive as archive_service
from app.services.sessions import Principal

router = APIRouter(prefix="/archive", tags=["archivo"], dependencies=[Depends(get_case_worker)])

_BOGOTA = ZoneInfo("America/Bogota")
_NO_STORE = {"Cache-Control": "no-store"}


def _filters(
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=120,
            description=(
                "Título, radicado, referencia interna, despacho, nombre de un archivo o el "
                "comienzo de su huella SHA-256."
            ),
        ),
    ] = None,
    closed_from: Annotated[
        datetime.date | None, Query(description="Fecha inicial de cierre en Colombia.")
    ] = None,
    closed_to: Annotated[
        datetime.date | None, Query(description="Fecha final de cierre en Colombia.")
    ] = None,
    retention_basis: Annotated[
        Literal["organization_policy", "legal_or_contractual_duty", "litigation_hold"] | None,
        Query(description="Fundamento de conservación."),
    ] = None,
    legal_hold: Annotated[
        bool | None, Query(description="Si el caso tiene bloqueo jurídico.")
    ] = None,
    retention_review: Annotated[
        Literal["due", "upcoming"] | None,
        Query(description="Conservación vencida para revisión o todavía vigente."),
    ] = None,
    practice_area: Annotated[
        PracticeArea | None, Query(description="Especialidad del caso.")
    ] = None,
) -> archive_service.ArchiveFilters:
    if closed_from is not None and closed_to is not None and closed_from > closed_to:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La fecha inicial de cierre no puede ser posterior a la final.",
        )
    return archive_service.ArchiveFilters(
        search=search,
        closed_from=_archive_boundary(closed_from) if closed_from is not None else None,
        closed_to=_archive_boundary(closed_to, next_day=True) if closed_to is not None else None,
        retention_basis=retention_basis,
        legal_hold=legal_hold,
        retention_review=retention_review,
        practice_area=practice_area,
    )


@router.get("/summary", summary="Cifras del archivo de casos cerrados")
def archive_summary(
    response: Response,
    principal: Annotated[Principal, Depends(get_case_worker)],
    session: Annotated[Session, Depends(get_session)],
    filters: Annotated[archive_service.ArchiveFilters, Depends(_filters)],
) -> ArchiveSummaryOut:
    response.headers["Cache-Control"] = "no-store"
    row = archive_service.summary(session, principal, filters)
    return ArchiveSummaryOut(
        cases=row.cases,
        evidences=row.evidences,
        stored_bytes=row.stored_bytes,
        legal_hold=row.legal_hold,
        review_due=row.review_due,
        review_upcoming=row.review_upcoming,
        by_year=[ArchiveYearOut(year=year, cases=count) for year, count in row.by_year],
        by_retention_basis=[
            ArchiveBasisOut.model_validate({"retention_basis": basis, "cases": count})
            for basis, count in row.by_basis
        ],
        by_practice_area=[
            ArchiveAreaOut.model_validate({"practice_area": area, "cases": count})
            for area, count in row.by_practice_area
        ],
    )


@router.get(
    "/export",
    summary="Descargar el índice del archivo como hoja de cálculo (CSV)",
    response_class=Response,
    responses={status.HTTP_200_OK: {"content": {"text/csv": {}}}},
)
def archive_export(
    principal: Annotated[Principal, Depends(get_case_worker)],
    session: Annotated[Session, Depends(get_session)],
    filters: Annotated[archive_service.ArchiveFilters, Depends(_filters)],
    client_ip: Annotated[str, Depends(get_client_ip)],
    user_agent: Annotated[str | None, Header(include_in_schema=False)] = None,
) -> Response:
    content, rows = archive_service.export_index(session, principal, filters, _BOGOTA)
    # Llevarse el índice del archivo queda en la auditoría del despacho, con cuántas filas salieron.
    archive_service.record_export(
        session, principal, rows, filters, client_ip=client_ip, user_agent=user_agent
    )
    session.commit()
    stamp = datetime.datetime.now(_BOGOTA).strftime("%Y%m%d")
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            **_NO_STORE,
            "Content-Disposition": f'attachment; filename="archivo-de-casos-{stamp}.csv"',
        },
    )
