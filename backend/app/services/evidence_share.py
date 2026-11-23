"""Enlaces para compartir una sola evidencia: crearlos, revocarlos y descargar con ellos.

Quien recibe el enlace no tiene cuenta. Por eso todo lo que ocurre con el enlace queda en la
cadena de custodia del caso: la creación y la revocación con quien las hizo, y cada descarga con
actor nulo. La IP y el navegador de quien descarga quedan en la auditoría del despacho, no en la
cadena, porque la cadena viaja dentro de los paquetes de preservación.

Antes de ofrecer la descarga se verifica todo el contenido contra su huella, igual que en la
descarga con sesión: un enlace nunca entrega un archivo alterado.
"""

import datetime
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session
from tink import streaming_aead

from app.adapters.keys import KeyWrapper, WrappedKey
from app.core.case_keys import open_case_key
from app.core.config import Settings
from app.core.permissions import has_permission
from app.core.tokens import (
    InvalidShareLinkError,
    issue_share_link,
    read_share_link,
)
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Case, CustodyEvent, Evidence, EvidenceShareLink, Membership, User
from app.repositories import cases as cases_repository
from app.services.audit import audit_ip, audit_user_agent
from app.services.cases import CaseNotFoundError
from app.services.evidence_download import (
    DownloadForbidden,
    EvidenceIntegrityError,
    PreparedDownload,
)
from app.services.evidence_upload import ASSOCIATED_PREFIX
from app.services.sessions import Principal

MAX_HOURS = 24 * 30
SHARE_PATH = "/compartido"


class LinkNotFoundError(Exception):
    """El enlace no existe para esa evidencia."""


@dataclass(frozen=True, slots=True)
class LinkView:
    link: EvidenceShareLink
    created_by_name: str

    @property
    def status(self) -> str:
        if self.link.revoked_at is not None:
            return "revoked"
        if self.link.expires_at <= datetime.datetime.now(datetime.UTC):
            return "expired"
        return "active"


@dataclass(frozen=True, slots=True)
class SharedInfo:
    filename: str
    size_bytes: int
    sha256: bytes
    expires_at: datetime.datetime


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


def _member_evidence(
    session: Session, principal: Principal, case_id: uuid.UUID, evidence_id: uuid.UUID
) -> tuple[Case, Evidence]:
    """El caso y la evidencia, si la persona es miembro y puede descargar originales."""
    organization_id = principal.organization_id
    if organization_id is None:
        raise CaseNotFoundError
    set_tenant(session, TenantContext(organization_id, principal.user_id))
    case = cases_repository.case_for_member(session, case_id, principal.user_id)
    if case is None or case.organization_id != organization_id or case.status == "deleting":
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
    return case, evidence


def _append_custody(
    session: Session,
    case: Case,
    evidence_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    action: str,
    details: dict[str, str | int | None],
) -> None:
    """Agrega un evento a la cadena. El caso ya debe estar bloqueado."""
    previous = session.scalar(
        select(CustodyEvent.event_hash).where(
            CustodyEvent.case_id == case.id, CustodyEvent.seq == case.custody_seq
        )
    )
    if previous is None:
        raise EvidenceIntegrityError
    session.add(
        CustodyEvent(
            organization_id=case.organization_id,
            case_id=case.id,
            seq=case.custody_seq + 1,
            evidence_id=evidence_id,
            actor_user_id=actor_user_id,
            action=action,
            details=details,
            occurred_at=_now(),
            prev_hash=previous,
        )
    )
    session.flush()


def _locked_case(session: Session, principal: Principal, case_id: uuid.UUID) -> Case:
    case = cases_repository.case_for_member_update(session, case_id, principal.user_id)
    if case is None or case.status == "deleting":
        raise CaseNotFoundError
    return case


def create_link(
    session: Session,
    settings: Settings,
    principal: Principal,
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    *,
    hours: int,
    label: str | None,
) -> tuple[LinkView, str]:
    """Crea el enlace y lo devuelve una sola vez: no se guarda, solo su identificador."""
    session.commit()
    with session.begin():
        _member_evidence(session, principal, case_id, evidence_id)
        case = _locked_case(session, principal, case_id)
        now = _now()
        expires_at = now + datetime.timedelta(hours=min(hours, MAX_HOURS))
        link = EvidenceShareLink(
            organization_id=case.organization_id,
            case_id=case.id,
            evidence_id=evidence_id,
            created_by=principal.user_id,
            label=label,
            expires_at=expires_at,
        )
        session.add(link)
        session.flush()
        _append_custody(
            session,
            case,
            evidence_id,
            principal.user_id,
            "evidence_link_created",
            {"link_id": str(link.id), "expires_at": expires_at.isoformat()},
        )
        token = issue_share_link(
            settings.signing_key(), link.id, case.organization_id, evidence_id, expires_at, now=now
        )
        name = session.scalar(select(User.full_name).where(User.id == principal.user_id)) or ""
    return LinkView(link, name), f"{settings.public_url}{SHARE_PATH}#t={token}"


def list_links(
    session: Session, principal: Principal, case_id: uuid.UUID, evidence_id: uuid.UUID
) -> list[LinkView]:
    _member_evidence(session, principal, case_id, evidence_id)
    rows = session.execute(
        select(EvidenceShareLink, User.full_name)
        .join(User, User.id == EvidenceShareLink.created_by)
        .where(EvidenceShareLink.evidence_id == evidence_id)
        .order_by(EvidenceShareLink.id.desc())
        .limit(50)
    ).all()
    return [LinkView(link, name) for link, name in rows]


def revoke_link(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    evidence_id: uuid.UUID,
    link_id: uuid.UUID,
) -> None:
    session.commit()
    with session.begin():
        _member_evidence(session, principal, case_id, evidence_id)
        case = _locked_case(session, principal, case_id)
        link = session.scalar(
            select(EvidenceShareLink)
            .where(
                EvidenceShareLink.id == link_id,
                EvidenceShareLink.evidence_id == evidence_id,
                EvidenceShareLink.organization_id == case.organization_id,
            )
            .with_for_update()
        )
        if link is None:
            raise LinkNotFoundError
        if link.revoked_at is not None:
            return
        link.revoked_at = _now()
        link.revoked_by = principal.user_id
        _append_custody(
            session,
            case,
            evidence_id,
            principal.user_id,
            "evidence_link_revoked",
            {"link_id": str(link.id)},
        )


def _active(
    session: Session, settings: Settings, token: str
) -> tuple[EvidenceShareLink, Evidence, Case]:
    """Carga el enlace bajo RLS con la sola organización del token y comprueba que siga vivo."""
    claims = read_share_link(settings.signing_key(), token)
    set_tenant(session, TenantContext(organization_id=claims.organization_id))
    row = session.execute(
        select(EvidenceShareLink, Evidence, Case)
        .join(
            Evidence,
            (Evidence.id == EvidenceShareLink.evidence_id)
            & (Evidence.case_id == EvidenceShareLink.case_id),
        )
        .join(Case, Case.id == EvidenceShareLink.case_id)
        .where(
            EvidenceShareLink.id == claims.link_id,
            EvidenceShareLink.organization_id == claims.organization_id,
            EvidenceShareLink.evidence_id == claims.evidence_id,
            EvidenceShareLink.revoked_at.is_(None),
            EvidenceShareLink.expires_at > _now(),
            Case.status != "deleting",
        )
    ).one_or_none()
    if row is None:
        raise InvalidShareLinkError
    return row[0], row[1], row[2]


def inspect(session: Session, settings: Settings, token: str) -> SharedInfo:
    link, evidence, _ = _active(session, settings, token)
    return SharedInfo(
        evidence.original_filename, evidence.size_bytes, evidence.sha256, link.expires_at
    )


def prepare_shared_download(
    session: Session,
    settings: Settings,
    wrapper: KeyWrapper,
    token: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> PreparedDownload:
    """Verifica el archivo, deja constancia de la descarga y entrega el flujo ya comprobado."""
    link, evidence, case = _active(session, settings, token)
    if case.wrapped_key is None:
        raise EvidenceIntegrityError
    wrapped = WrappedKey(case.wrapped_key, case.key_version)
    organization_id = case.organization_id
    case_id = case.id
    evidence_id = evidence.id
    link_id = link.id
    download = PreparedDownload(
        evidence.original_filename,
        evidence.size_bytes,
        evidence.sha256,
        evidence.storage_key,
        ASSOCIATED_PREFIX + case_id.bytes + evidence_id.bytes,
        open_case_key(wrapper, wrapped).primitive(streaming_aead.StreamingAead),
        settings,
    )
    session.commit()  # KMS y S3 se consultan sin una transacción abierta.
    for _ in download.chunks():
        pass  # Verifica todo el contenido antes de registrar y ofrecer la descarga.
    with session.begin():
        set_tenant(session, TenantContext(organization_id=organization_id))
        locked = session.scalar(
            select(Case)
            .where(Case.id == case_id, Case.organization_id == organization_id)
            .with_for_update()
        )
        current = session.scalar(
            select(EvidenceShareLink)
            .where(
                EvidenceShareLink.id == link_id,
                EvidenceShareLink.revoked_at.is_(None),
                EvidenceShareLink.expires_at > _now(),
            )
            .with_for_update()
        )
        if locked is None or locked.status == "deleting" or current is None:
            raise InvalidShareLinkError
        now = _now()
        current.download_count += 1
        current.last_downloaded_at = now
        _append_custody(
            session,
            locked,
            evidence_id,
            None,
            "evidence_link_downloaded",
            {
                "link_id": str(link_id),
                "sha256": download.sha256.hex(),
                "size_bytes": download.size_bytes,
            },
        )
        session.add(
            AuditLog(
                organization_id=organization_id,
                actor_user_id=None,
                action="evidence_link_downloaded",
                target_id=evidence_id,
                details={"case_id": str(case_id), "link_id": str(link_id)},
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
                created_at=now,
            )
        )
    return download
