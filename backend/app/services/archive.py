"""Banco de datos: el archivo de casos cerrados de una persona.

Es una vista de lectura sobre los casos donde la persona es miembro: no concede acceso a ningún
caso nuevo. Reúne las cifras del archivo y el índice exportable, con los mismos filtros que la
lista de casos para que lo que se ve y lo que se descarga siempre coincidan.
"""

import csv
import datetime
import io
from dataclasses import dataclass
from typing import Final, Literal

from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.repositories import cases as cases_repository
from app.repositories.cases import ArchiveSummaryRow
from app.services import cases as cases_service
from app.services.sessions import Principal

# Tope del índice exportado: más allá, conviene filtrar por año o por especialidad.
EXPORT_MAX_ROWS: Final = 5000
_PAGE: Final = 200
_FORMULA_PREFIXES: Final = ("=", "+", "-", "@", "\t", "\r")

PRACTICE_AREA_LABELS: Final = {
    "civil": "Civil",
    "commercial": "Comercial",
    "family": "Familia",
    "labor": "Laboral",
    "criminal": "Penal",
    "administrative": "Administrativo",
    "constitutional": "Constitucional",
    "other": "Otra",
}
RETENTION_BASIS_LABELS: Final = {
    "organization_policy": "Política del despacho",
    "legal_or_contractual_duty": "Deber legal o contractual",
    "litigation_hold": "Bloqueo por litigio",
}


@dataclass(frozen=True, slots=True)
class ArchiveFilters:
    search: str | None = None
    closed_from: datetime.datetime | None = None
    closed_to: datetime.datetime | None = None
    retention_basis: str | None = None
    legal_hold: bool | None = None
    retention_review: Literal["due", "upcoming"] | None = None
    practice_area: str | None = None


def summary(session: Session, principal: Principal, filters: ArchiveFilters) -> ArchiveSummaryRow:
    organization_id = principal.organization_id
    if organization_id is None:
        return ArchiveSummaryRow(0, 0, 0, 0, 0, 0, [], [], [])
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=principal.user_id))
    return cases_repository.archive_summary(
        session,
        organization_id,
        principal.user_id,
        review_at=datetime.datetime.now(datetime.UTC),
        search=filters.search,
        closed_from=filters.closed_from,
        closed_to=filters.closed_to,
        retention_basis=filters.retention_basis,
        legal_hold=filters.legal_hold,
        retention_review=filters.retention_review,
        practice_area=filters.practice_area,
    )


def _cell(value: object) -> str:
    """Un valor de texto seguro para una hoja de cálculo: lo que empieza como fórmula se
    neutraliza para que Excel no lo ejecute."""
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(_FORMULA_PREFIXES) else text


def _date(value: datetime.datetime | None, zone: datetime.tzinfo) -> str:
    return value.astimezone(zone).strftime("%Y-%m-%d") if value is not None else ""


def export_index(
    session: Session, principal: Principal, filters: ArchiveFilters, zone: datetime.tzinfo
) -> str:
    """El índice del archivo como CSV. Empieza con la marca de orden de bytes para que Excel
    lea las tildes. Son a lo sumo EXPORT_MAX_ROWS filas: cabe entera en memoria."""
    buffer = io.StringIO()
    buffer.write("﻿")
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(
        [
            "Título",
            "Radicado",
            "Despacho judicial",
            "Especialidad",
            "Referencia interna",
            "Cerrado el",
            "Base de conservación",
            "Conservar hasta",
            "Bloqueo por litigio",
            "Evidencias",
            "Miembros",
        ]
    )
    exported = 0
    cursor: str | None = None
    while exported < EXPORT_MAX_ROWS:
        page = cases_service.list_cases(
            session,
            principal,
            status="closed",
            cursor=cursor,
            limit=min(_PAGE, EXPORT_MAX_ROWS - exported),
            search=filters.search,
            closed_from=filters.closed_from,
            closed_to=filters.closed_to,
            retention_basis=filters.retention_basis,
            legal_hold=filters.legal_hold,
            retention_review=filters.retention_review,
            practice_area=filters.practice_area,
        )
        for item in page.items:
            writer.writerow(
                _cell(value)
                for value in (
                    item.title,
                    item.filing_number,
                    item.court,
                    PRACTICE_AREA_LABELS.get(item.practice_area or "", ""),
                    item.internal_reference,
                    _date(item.closed_at, zone),
                    RETENTION_BASIS_LABELS.get(item.retention_basis or "", ""),
                    _date(item.retention_until, zone),
                    "Sí" if item.legal_hold else "No",
                    sum(item.evidence_by_type.values()),
                    item.member_count,
                )
            )
        exported += len(page.items)
        cursor = page.next_cursor
        if cursor is None:
            break
    return buffer.getvalue()
