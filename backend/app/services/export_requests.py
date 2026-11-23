"""Solicitud y consulta de paquetes por miembros autorizados del caso."""

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.permissions import has_permission
from app.db.tenancy import TenantContext, set_tenant
from app.models import Case, CustodyEvent, Export, Membership, User
from app.repositories import cases as cases_repository
from app.services import jobs
from app.services.export_links import link_for_export
from app.services.sessions import Principal


class ExportNotFound(Exception):
    pass


class ExportForbidden(Exception):
    pass


class CaseUnavailable(Exception):
    pass


@dataclass(frozen=True, slots=True)
class ExportView:
    id: uuid.UUID
    status: str
    created_at: datetime.datetime
    expires_at: datetime.datetime | None
    download_url: str | None


@dataclass(frozen=True, slots=True)
class ExportListItem:
    """Un paquete del historial del caso, con quién lo pidió y su huella."""

    id: uuid.UUID
    status: str
    created_at: datetime.datetime
    expires_at: datetime.datetime | None
    download_url: str | None
    requested_by_name: str
    manifest_sha256: bytes | None


def _case_member(session: Session, principal: Principal, case_id: uuid.UUID, *, lock: bool) -> Case:
    org_id = principal.organization_id
    if org_id is None:
        raise ExportNotFound
    set_tenant(session, TenantContext(org_id, principal.user_id))
    case = (
        cases_repository.case_for_member_update(session, case_id, principal.user_id)
        if lock
        else cases_repository.case_for_member(session, case_id, principal.user_id)
    )
    if case is None or case.organization_id != org_id:
        raise ExportNotFound
    role_query = select(Membership.role).where(
        Membership.organization_id == org_id, Membership.user_id == principal.user_id
    )
    if lock:
        role_query = role_query.with_for_update(read=True)
    role = session.scalar(role_query)
    if not has_permission(role, "cases.download_evidence"):
        raise ExportForbidden
    if case.status == "deleting":
        raise CaseUnavailable
    return case


def request_export(session: Session, principal: Principal, case_id: uuid.UUID) -> ExportView:
    """Encola una exportación y registra la solicitud de custodia en el mismo commit."""
    session.commit()
    with session.begin():
        case = _case_member(session, principal, case_id, lock=True)
        org_id = case.organization_id
        previous = session.scalar(
            select(CustodyEvent.event_hash).where(
                CustodyEvent.case_id == case_id, CustodyEvent.seq == case.custody_seq
            )
        )
        if previous is None:
            raise CaseUnavailable
        export_id = uuid.uuid7()
        export = Export(
            id=export_id,
            organization_id=org_id,
            case_id=case_id,
            requested_by=principal.user_id,
            status="queued",
        )
        session.add(export)
        session.add(
            CustodyEvent(
                organization_id=org_id,
                case_id=case_id,
                seq=case.custody_seq + 1,
                actor_user_id=principal.user_id,
                action="export_requested",
                details={"export_id": str(export_id)},
                occurred_at=datetime.datetime.now(datetime.UTC),
                prev_hash=previous,
            )
        )
        jobs.enqueue(
            session,
            "export_build",
            {"export_id": str(export_id), "organization_id": str(org_id)},
            f"export_build:{export_id}",
        )
        session.flush()
        view = ExportView(export.id, export.status, export.created_at, None, None)
    return view


def get_export(
    session: Session,
    settings: Settings,
    principal: Principal,
    case_id: uuid.UUID,
    export_id: uuid.UUID,
) -> ExportView:
    _case_member(session, principal, case_id, lock=False)
    org_id = principal.organization_id
    export = session.scalar(
        select(Export).where(
            Export.id == export_id,
            Export.case_id == case_id,
            Export.organization_id == org_id,
        )
    )
    if export is None:
        raise ExportNotFound
    now = datetime.datetime.now(datetime.UTC)
    if export.status == "ready" and export.expires_at is not None and export.expires_at <= now:
        return ExportView(export.id, "expired", export.created_at, export.expires_at, None)
    link = link_for_export(settings, export, now=now) if export.status == "ready" else None
    return ExportView(export.id, export.status, export.created_at, export.expires_at, link)


def list_exports(
    session: Session,
    settings: Settings,
    principal: Principal,
    case_id: uuid.UUID,
    *,
    limit: int = 20,
) -> list[ExportListItem]:
    """Los paquetes más recientes del caso, del más nuevo al más antiguo. Un paquete listo cuyo
    enlace ya venció aparece como vencido, sin enlace."""
    _case_member(session, principal, case_id, lock=False)
    rows = session.execute(
        select(Export, User.full_name)
        .join(User, User.id == Export.requested_by)
        .where(Export.case_id == case_id, Export.organization_id == principal.organization_id)
        .order_by(Export.id.desc())
        .limit(limit)
    ).all()
    now = datetime.datetime.now(datetime.UTC)
    items: list[ExportListItem] = []
    for export, name in rows:
        status = export.status
        link = None
        if status == "ready":
            if export.expires_at is not None and export.expires_at <= now:
                status = "expired"
            else:
                link = link_for_export(settings, export, now=now)
        items.append(
            ExportListItem(
                export.id,
                status,
                export.created_at,
                export.expires_at,
                link,
                name,
                export.manifest_sha256,
            )
        )
    return items
