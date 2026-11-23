"""Documentos del portal: copias que el despacho sube aparte para el cliente (ADR-054).

No son evidencia. No entran a la cadena de custodia ni se mezclan con los originales: el abogado
sube un archivo pensado para el cliente (una copia, un resumen). Se cifran con la llave del caso,
con datos asociados propios, y cuentan para el espacio del plan. Quitar un documento lo oculta y
bloquea su descarga; el objeto cifrado se conserva hasta que el caso se elimine.

Antes de entregar una descarga se verifica todo el contenido contra su huella, igual que con la
evidencia: un enlace nunca entrega un archivo alterado.
"""

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
from app.core.config import Settings
from app.core.tokens import InvalidPortalLinkError
from app.db.tenancy import TenantContext, set_tenant
from app.models import (
    AuditLog,
    Case,
    ClientPortalAccess,
    ClientPortalDocument,
    Organization,
    Plan,
    Subscription,
    User,
)
from app.services.audit import audit_ip, audit_user_agent
from app.services.client_portal import (
    CaseNotFoundError,
    ClosedCasePortalError,
    NoticeNotAcceptedError,
    PortalNotAllowedError,
    _allowed,
    _live_access,
)
from app.services.evidence_download import EvidenceIntegrityError, PreparedDownload
from app.services.evidence_stream import ReceivedFile, receive
from app.services.sessions import Principal
from app.services.tasks import _active_organization, _member_case

ASSOCIATED_PREFIX: Final = b"aletheia/portal-documento/v1"
MAX_DOCUMENT_BYTES: Final = 25 * 1024 * 1024
LIST_LIMIT: Final = 200

__all__ = [
    "MAX_DOCUMENT_BYTES",
    "CaseNotFoundError",
    "ClosedCasePortalError",
    "DocumentNotFoundError",
    "DocumentUnavailableError",
    "DocumentView",
    "NoticeNotAcceptedError",
    "PortalNotAllowedError",
    "QuotaExceededError",
]


class DocumentNotFoundError(Exception):
    """El documento no existe, ya se quitó o es de otro caso."""


class DocumentUnavailableError(Exception):
    """El caso o el despacho no admiten documentos nuevos."""


class QuotaExceededError(Exception):
    """El archivo supera el tamaño permitido o el espacio que queda del plan."""


@dataclass(frozen=True, slots=True)
class DocumentView:
    document: ClientPortalDocument
    uploaded_by_name: str


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


@dataclass(frozen=True, slots=True)
class _Limit:
    wrapped_key: WrappedKey
    max_bytes: int


def _limits(session: Session, principal: Principal, case_id: uuid.UUID) -> _Limit:
    _allowed(principal)
    case = _member_case(session, principal, case_id, lock=False)
    organization = session.get(Organization, case.organization_id)
    if organization is None or organization.status != "active" or case.status != "open":
        raise DocumentUnavailableError
    plan = session.scalar(
        select(Plan)
        .join(Subscription, Subscription.plan_id == Plan.id)
        .where(
            Subscription.organization_id == case.organization_id,
            Subscription.status.in_(("trial", "active")),
        )
    )
    if plan is None or case.wrapped_key is None:
        raise DocumentUnavailableError
    available = plan.storage_limit_bytes - organization.storage_used_bytes
    if available <= 0:
        raise QuotaExceededError
    return _Limit(
        WrappedKey(case.wrapped_key, case.key_version),
        min(plan.max_file_bytes, available, MAX_DOCUMENT_BYTES),
    )


def _record(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    document_id: uuid.UUID,
    storage_key: str,
    received: ReceivedFile,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    _allowed(principal)
    case = _member_case(session, principal, case_id, lock=True)
    organization = session.scalar(
        select(Organization).where(Organization.id == case.organization_id).with_for_update()
    )
    if organization is None or organization.status != "active" or case.status != "open":
        raise DocumentUnavailableError
    plan = session.scalar(
        select(Plan)
        .join(Subscription, Subscription.plan_id == Plan.id)
        .where(
            Subscription.organization_id == case.organization_id,
            Subscription.status.in_(("trial", "active")),
        )
        .with_for_update(read=True, of=Subscription)
    )
    if plan is None:
        raise DocumentUnavailableError
    if (
        received.size > min(plan.max_file_bytes, MAX_DOCUMENT_BYTES)
        or organization.storage_used_bytes + received.size > plan.storage_limit_bytes
    ):
        raise QuotaExceededError
    organization.storage_used_bytes += received.size
    session.add(
        ClientPortalDocument(
            id=document_id,
            organization_id=case.organization_id,
            case_id=case.id,
            uploaded_by=principal.user_id,
            filename=received.filename,
            content_type=received.content_type,
            size_bytes=received.size,
            sha256=received.sha256,
            storage_key=storage_key,
        )
    )
    session.flush()
    session.add(
        AuditLog(
            organization_id=case.organization_id,
            actor_user_id=principal.user_id,
            action="client_portal_document_added",
            target_id=document_id,
            details={"case_id": str(case.id), "size_bytes": str(received.size)},
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
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
    document_id: uuid.UUID,
    storage_key: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> ReceivedFile:
    """Lee el cuerpo una sola vez, lo cifra mientras llega y limpia el objeto si algo falla."""
    try:
        limits = _limits(session, principal, case_id)
        session.commit()  # No se mantiene conexión ni bloqueo durante KMS o S3.
        cipher = open_case_key(wrapper, limits.wrapped_key).primitive(streaming_aead.StreamingAead)
        associated = ASSOCIATED_PREFIX + case_id.bytes + document_id.bytes
        with cipher.new_encrypting_stream(sink, associated) as encrypting:
            received = receive(request, encrypting.write, limits.max_bytes)
        sink.commit()
        with session.begin():
            _record(
                session,
                principal,
                case_id,
                document_id,
                storage_key,
                received,
                client_ip=client_ip,
                user_agent=user_agent,
            )
        return received
    except BaseException:
        session.rollback()
        sink.abort()
        raise


def list_documents(
    session: Session, principal: Principal, case_id: uuid.UUID
) -> list[DocumentView]:
    _allowed(principal)
    _member_case(session, principal, case_id, lock=False)
    rows = session.execute(
        select(ClientPortalDocument, User.full_name)
        .join(User, User.id == ClientPortalDocument.uploaded_by)
        .where(ClientPortalDocument.case_id == case_id, ClientPortalDocument.removed_at.is_(None))
        .order_by(ClientPortalDocument.id.desc())
        .limit(LIST_LIMIT)
    ).all()
    return [DocumentView(document, name) for document, name in rows]


def remove(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    document_id: uuid.UUID,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    _allowed(principal)
    session.commit()
    with session.begin():
        case = _member_case(session, principal, case_id, lock=True)
        _active_organization(session, case.organization_id)
        document = session.scalar(
            select(ClientPortalDocument)
            .where(ClientPortalDocument.id == document_id, ClientPortalDocument.case_id == case.id)
            .with_for_update()
        )
        if document is None:
            raise DocumentNotFoundError
        if document.removed_at is not None:
            return
        document.removed_at = _now()
        document.removed_by = principal.user_id
        session.add(
            AuditLog(
                organization_id=case.organization_id,
                actor_user_id=principal.user_id,
                action="client_portal_document_removed",
                target_id=document.id,
                details={"case_id": str(case.id)},
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
            )
        )
        session.flush()


def prepare_download(
    session: Session,
    settings: Settings,
    wrapper: KeyWrapper,
    token: str,
    document_id: uuid.UUID,
    *,
    client_ip: str,
    user_agent: str | None,
) -> PreparedDownload:
    """Verifica el archivo, deja constancia de la descarga y entrega el flujo ya comprobado."""
    access, case = _live_access(session, settings, token, lock=False)
    if access.notice_accepted_at is None:
        raise NoticeNotAcceptedError
    document = session.scalar(
        select(ClientPortalDocument).where(
            ClientPortalDocument.id == document_id,
            ClientPortalDocument.case_id == case.id,
            ClientPortalDocument.removed_at.is_(None),
        )
    )
    if document is None:
        raise InvalidPortalLinkError
    if case.wrapped_key is None:
        raise EvidenceIntegrityError
    organization_id = access.organization_id
    access_id = access.id
    case_id = case.id
    wrapped = WrappedKey(case.wrapped_key, case.key_version)
    download = PreparedDownload(
        document.filename,
        document.size_bytes,
        document.sha256,
        document.storage_key,
        ASSOCIATED_PREFIX + case_id.bytes + document.id.bytes,
        open_case_key(wrapper, wrapped).primitive(streaming_aead.StreamingAead),
        settings,
    )
    session.commit()  # KMS y S3 se consultan sin una transacción abierta.
    for _ in download.chunks():
        pass  # Verifica todo el contenido antes de registrar y ofrecer la descarga.
    with session.begin():
        set_tenant(session, TenantContext(organization_id=organization_id))
        still_open = session.scalar(
            select(ClientPortalAccess.id)
            .join(ClientPortalDocument, ClientPortalDocument.case_id == ClientPortalAccess.case_id)
            .join(Case, Case.id == ClientPortalAccess.case_id)
            .where(
                ClientPortalAccess.id == access_id,
                ClientPortalAccess.revoked_at.is_(None),
                ClientPortalAccess.expires_at > _now(),
                ClientPortalDocument.id == document_id,
                ClientPortalDocument.removed_at.is_(None),
                Case.status != "deleting",
            )
        )
        if still_open is None:
            raise InvalidPortalLinkError
        session.add(
            AuditLog(
                organization_id=organization_id,
                actor_user_id=None,
                action="client_portal_document_downloaded",
                target_id=document_id,
                details={"case_id": str(case_id)},
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
            )
        )
        session.flush()
    return download
