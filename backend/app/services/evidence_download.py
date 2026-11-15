"""Descarga del original: permiso, integridad y evento de custodia."""

import datetime
import hashlib
import hmac
import uuid
from collections.abc import Iterator
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session
from tink import streaming_aead

from app.adapters.evidence_storage import open_encrypted_evidence
from app.adapters.keys import KeyWrapper, WrappedKey
from app.core.case_keys import open_case_key
from app.core.config import Settings
from app.core.permissions import has_permission
from app.db.tenancy import TenantContext, set_tenant
from app.models import CustodyEvent, Evidence, Membership
from app.repositories import cases as cases_repository
from app.services.cases import CaseNotFoundError
from app.services.evidence_upload import ASSOCIATED_PREFIX
from app.services.sessions import Principal

CHUNK_BYTES = 64 * 1024


class DownloadForbidden(Exception):
    """El miembro no tiene permiso para obtener el original."""


class EvidenceIntegrityError(Exception):
    """El contenido descifrado no coincide con la huella conservada."""


@dataclass(frozen=True)
class PreparedDownload:
    filename: str
    size_bytes: int
    sha256: bytes
    storage_key: str
    associated_data: bytes
    cipher: streaming_aead.StreamingAead
    settings: Settings

    def chunks(self) -> Iterator[bytes]:
        digest = hashlib.sha256()
        size = 0
        with (
            open_encrypted_evidence(self.settings, self.storage_key) as source,
            self.cipher.new_decrypting_stream(source, self.associated_data) as reader,
        ):
            while chunk := reader.read(CHUNK_BYTES):
                digest.update(chunk)
                size += len(chunk)
                yield chunk
        if size != self.size_bytes or not hmac.compare_digest(digest.digest(), self.sha256):
            raise EvidenceIntegrityError


def prepare_download(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    wrapper: KeyWrapper,
    settings: Settings,
) -> PreparedDownload:
    organization_id = principal.organization_id
    if organization_id is None:
        raise CaseNotFoundError
    set_tenant(session, TenantContext(organization_id, principal.user_id))
    case = cases_repository.case_for_member(session, case_id, principal.user_id)
    if case is None or case.organization_id != organization_id:
        raise CaseNotFoundError
    evidence = session.scalar(
        select(Evidence).where(
            Evidence.organization_id == organization_id,
            Evidence.case_id == case_id,
            Evidence.id == evidence_id,
        )
    )
    if evidence is None:
        raise CaseNotFoundError
    role = session.scalar(
        select(Membership.role).where(
            Membership.organization_id == organization_id,
            Membership.user_id == principal.user_id,
        )
    )
    if not has_permission(role, "cases.download_evidence"):
        raise DownloadForbidden
    if case.wrapped_key is None:
        raise EvidenceIntegrityError
    wrapped = WrappedKey(case.wrapped_key, case.key_version)
    filename = evidence.original_filename
    size_bytes = evidence.size_bytes
    sha256 = evidence.sha256
    storage_key = evidence.storage_key
    session.commit()  # KMS y S3 se consultan sin una transacción abierta.
    cipher = open_case_key(wrapper, wrapped).primitive(streaming_aead.StreamingAead)
    download = PreparedDownload(
        filename,
        size_bytes,
        sha256,
        storage_key,
        ASSOCIATED_PREFIX + case_id.bytes + evidence_id.bytes,
        cipher,
        settings,
    )
    for _ in download.chunks():
        pass  # Verifica todo el contenido antes de registrar y ofrecer la descarga.
    with session.begin():
        set_tenant(session, TenantContext(organization_id, principal.user_id))
        locked_case = cases_repository.case_for_member_update(session, case_id, principal.user_id)
        if locked_case is None:
            raise CaseNotFoundError
        current_role = session.scalar(
            select(Membership.role).where(
                Membership.organization_id == organization_id,
                Membership.user_id == principal.user_id,
            )
        )
        if not has_permission(current_role, "cases.download_evidence"):
            raise DownloadForbidden
        if (
            session.scalar(
                select(Evidence.id).where(
                    Evidence.id == evidence_id,
                    Evidence.organization_id == organization_id,
                    Evidence.case_id == case_id,
                )
            )
            is None
        ):
            raise CaseNotFoundError
        previous = session.scalar(
            select(CustodyEvent.event_hash).where(
                CustodyEvent.case_id == case_id,
                CustodyEvent.seq == locked_case.custody_seq,
            )
        )
        if previous is None:
            raise EvidenceIntegrityError
        session.add(
            CustodyEvent(
                organization_id=organization_id,
                case_id=case_id,
                seq=locked_case.custody_seq + 1,
                evidence_id=evidence_id,
                actor_user_id=principal.user_id,
                action="evidence_downloaded",
                details={"sha256": sha256.hex(), "size_bytes": size_bytes},
                occurred_at=datetime.datetime.now(datetime.UTC),
                prev_hash=previous,
            )
        )
        session.flush()
    return download
