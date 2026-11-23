"""Sello de tiempo de una evidencia: quién lo firmó, descargarlo y reintentarlo (HU-020).

El sello es la respuesta RFC 3161 completa de la autoridad (`TimeStampResp`). Con la huella
SHA-256 de la evidencia y esa respuesta, cualquiera puede comprobarlo sin ALETHEIA, por ejemplo
con `openssl ts -verify`. Un sello fallido se puede pedir otra vez; uno pendiente o ya sellado,
no.
"""

import datetime
import uuid
from dataclasses import dataclass

from asn1crypto import tsp
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import has_permission
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Evidence
from app.repositories import cases as cases_repository
from app.services import jobs
from app.services.audit import audit_ip, audit_user_agent
from app.services.cases import CaseNotFoundError
from app.services.evidence_download import DownloadForbidden
from app.services.sessions import Principal

__all__ = [
    "CaseNotFoundError",
    "DownloadForbidden",
    "NotRetryableError",
    "StampFile",
    "StampNotReadyError",
    "download",
    "retry",
    "timestamp_authority",
]


class StampNotReadyError(Exception):
    """La evidencia todavía no tiene sello."""


class NotRetryableError(Exception):
    """Solo un sello fallido se puede pedir otra vez."""


@dataclass(frozen=True, slots=True)
class StampFile:
    filename: str
    token: bytes
    sha256: str


def timestamp_authority(token: bytes | None) -> str | None:
    """El nombre de la autoridad que firmó el sello, o None si no se puede leer."""
    if not token:
        return None
    try:
        response = tsp.TimeStampResp.load(token)
        certificates = response["time_stamp_token"]["content"]["certificates"]
        for entry in certificates:
            certificate = entry.chosen
            if getattr(certificate, "ca", True):
                continue
            subject = certificate.subject.native
            name = subject.get("organization_name") or subject.get("common_name")
            if isinstance(name, str):
                return name
    except Exception:
        return None
    return None


def _evidence(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    *,
    lock: bool,
) -> Evidence:
    organization_id = principal.organization_id
    if organization_id is None:
        raise CaseNotFoundError
    set_tenant(session, TenantContext(organization_id, principal.user_id))
    case = cases_repository.case_for_member(session, case_id, principal.user_id)
    if case is None or case.organization_id != organization_id or case.status == "deleting":
        raise CaseNotFoundError
    query = select(Evidence).where(
        Evidence.id == evidence_id,
        Evidence.case_id == case_id,
        Evidence.organization_id == organization_id,
    )
    if lock:
        query = query.with_for_update()
    evidence = session.scalar(query)
    if evidence is None:
        raise CaseNotFoundError
    return evidence


def download(
    session: Session, principal: Principal, case_id: uuid.UUID, evidence_id: uuid.UUID
) -> StampFile:
    """El sello para verificarlo fuera de ALETHEIA."""
    evidence = _evidence(session, principal, case_id, evidence_id, lock=False)
    if evidence.tsa_status != "stamped" or evidence.tsa_token is None:
        raise StampNotReadyError
    return StampFile(evidence.original_filename, evidence.tsa_token, evidence.sha256.hex())


def retry(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """Pide otra vez el sello de una evidencia cuyo sello falló."""
    if not has_permission(principal.role, "cases.upload_evidence"):
        raise DownloadForbidden
    session.commit()
    with session.begin():
        evidence = _evidence(session, principal, case_id, evidence_id, lock=True)
        if evidence.tsa_status != "failed":
            raise NotRetryableError
        evidence.tsa_status = "pending"
        session.add(
            AuditLog(
                organization_id=evidence.organization_id,
                actor_user_id=principal.user_id,
                action="evidence_stamp_retried",
                target_id=evidence.id,
                details={"case_id": str(case_id)},
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
                created_at=datetime.datetime.now(datetime.UTC),
            )
        )
        jobs.enqueue(
            session,
            "tsa_stamp",
            {
                "evidence_id": str(evidence.id),
                "case_id": str(case_id),
                "organization_id": str(evidence.organization_id),
            },
            f"tsa_stamp:{evidence.id}:retry:{uuid.uuid7()}",
        )
        session.flush()
