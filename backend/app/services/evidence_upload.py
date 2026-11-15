"""Preservación de evidencia: autorización, cifrado y registro atómico de metadatos."""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from tink import streaming_aead

from app.adapters.evidence_storage import EvidenceSink
from app.adapters.keys import KeyWrapper, WrappedKey
from app.core.case_keys import open_case_key
from app.core.permissions import has_permission
from app.db.tenancy import TenantContext, set_tenant
from app.models import CustodyEvent, Evidence, Membership, Organization, Plan, Subscription
from app.repositories import cases as cases_repository
from app.services.custody_chain import GENESIS_HASH
from app.services.evidence_stream import ReceivedFile, receive
from app.services.sessions import Principal

ASSOCIATED_PREFIX: Final = b"aletheia/evidencia/v1"


class UploadForbidden(Exception):
    pass


class UploadUnavailable(Exception):
    pass


class QuotaExceeded(Exception):
    pass


@dataclass(frozen=True)
class UploadLimit:
    wrapped_key: WrappedKey
    max_file_bytes: int
    available_bytes: int


def _limits(session: Session, principal: Principal, case_id: uuid.UUID) -> UploadLimit:
    organization_id = principal.organization_id
    if organization_id is None:
        raise UploadForbidden
    set_tenant(session, TenantContext(organization_id, principal.user_id))
    case = cases_repository.case_for_member(session, case_id, principal.user_id)
    if case is None or case.organization_id != organization_id:
        raise UploadForbidden
    role = session.scalar(
        select(Membership.role).where(
            Membership.organization_id == organization_id,
            Membership.user_id == principal.user_id,
        )
    )
    if not has_permission(role, "cases.upload_evidence"):
        raise UploadForbidden
    organization = session.get(Organization, organization_id)
    if organization is None or organization.status != "active" or case.status != "open":
        raise UploadUnavailable
    plan = session.scalar(
        select(Plan)
        .join(Subscription, Subscription.plan_id == Plan.id)
        .where(
            Subscription.organization_id == organization_id,
            Subscription.status.in_(("trial", "active")),
        )
    )
    if plan is None:
        raise UploadUnavailable
    available = plan.storage_limit_bytes - organization.storage_used_bytes
    if available <= 0:
        raise QuotaExceeded
    if case.wrapped_key is None:
        raise UploadUnavailable
    return UploadLimit(
        WrappedKey(case.wrapped_key, case.key_version), plan.max_file_bytes, available
    )


def _record(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    storage_key: str,
    received: ReceivedFile,
) -> None:
    organization_id = principal.organization_id
    if organization_id is None:
        raise UploadForbidden
    set_tenant(session, TenantContext(organization_id, principal.user_id))
    # El bloqueo serializa el cálculo del siguiente número de custodia.
    case = cases_repository.case_for_member_update(session, case_id, principal.user_id)
    if case is None or case.organization_id != organization_id:
        raise UploadForbidden
    role = session.scalar(
        select(Membership.role)
        .where(
            Membership.organization_id == organization_id, Membership.user_id == principal.user_id
        )
        .with_for_update(read=True)
    )
    if not has_permission(role, "cases.upload_evidence"):
        raise UploadForbidden
    organization = session.scalar(
        select(Organization).where(Organization.id == organization_id).with_for_update()
    )
    if organization is None or organization.status != "active" or case.status != "open":
        raise UploadUnavailable
    plan = session.scalar(
        select(Plan)
        .join(Subscription, Subscription.plan_id == Plan.id)
        .where(
            Subscription.organization_id == organization_id,
            Subscription.status.in_(("trial", "active")),
        )
        .with_for_update(read=True, of=Subscription)
    )
    if plan is None:
        raise UploadUnavailable
    if received.size > plan.max_file_bytes or (
        organization.storage_used_bytes + received.size > plan.storage_limit_bytes
    ):
        raise QuotaExceeded
    previous = (
        session.scalar(
            select(CustodyEvent.event_hash).where(
                CustodyEvent.case_id == case.id, CustodyEvent.seq == case.custody_seq
            )
        )
        if case.custody_seq
        else GENESIS_HASH
    )
    if previous is None:
        raise LookupError("El caso no tiene un último evento de custodia")
    organization.storage_used_bytes += received.size
    evidence = Evidence(
        id=evidence_id,
        organization_id=organization_id,
        case_id=case_id,
        sha256=received.sha256,
        size_bytes=received.size,
        original_filename=received.filename,
        declared_type=received.declared_type,
        detected_type=received.content_type,
        declared_origin=received.declared_origin,
        storage_key=storage_key,
        uploaded_by=principal.user_id,
    )
    session.add(evidence)
    session.flush()
    session.add(
        CustodyEvent(
            organization_id=organization_id,
            case_id=case_id,
            seq=case.custody_seq + 1,
            evidence_id=evidence_id,
            actor_user_id=principal.user_id,
            action="evidence_uploaded",
            details={"sha256": received.sha256.hex(), "size_bytes": received.size},
            occurred_at=datetime.datetime.now(datetime.UTC),
            prev_hash=previous,
        )
    )
    session.flush()


def upload(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    request: Request,
    wrapper: KeyWrapper,
    sink: EvidenceSink,
    evidence_id: uuid.UUID,
    storage_key: str,
) -> ReceivedFile:
    """Lee el cuerpo una sola vez; limpia el objeto si falla cualquier etapa."""
    try:
        limits = _limits(session, principal, case_id)
        session.commit()  # No se mantiene conexión ni bloqueo durante KMS o S3.
        handle = open_case_key(wrapper, limits.wrapped_key)
        cipher = handle.primitive(streaming_aead.StreamingAead)
        associated = ASSOCIATED_PREFIX + case_id.bytes + evidence_id.bytes
        with cipher.new_encrypting_stream(sink, associated) as encrypting:
            received = receive(
                request, encrypting.write, min(limits.max_file_bytes, limits.available_bytes)
            )
        sink.commit()
        with session.begin():
            _record(session, principal, case_id, evidence_id, storage_key, received)
        return received
    except BaseException:
        session.rollback()
        sink.abort()
        raise
