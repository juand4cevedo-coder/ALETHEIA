"""Portal del cliente: lo que un despacho decide mostrarle a su cliente (ADR-054).

El despacho invita al cliente con su correo. El cliente no tiene cuenta: abre un enlace firmado,
lee y acepta un aviso sobre sus datos, y ve el título y el estado de su caso y los avisos que el
despacho publicó para él. Nada más del expediente llega al portal: ni notas, ni tareas, ni
evidencias.

El enlace no se guarda. La fila decide si sigue vigente: revocar el acceso lo invalida y reenviarlo
sube la versión, con lo que el enlace anterior deja de servir. Todo lo que hacen el despacho y el
cliente queda en la auditoría del despacho.
"""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.permissions import has_permission
from app.core.tokens import InvalidPortalLinkError, issue_portal_link, read_portal_link
from app.db.tenancy import TenantContext, set_tenant
from app.models import (
    AuditLog,
    Case,
    CaseMember,
    ClientPortalAccess,
    ClientPortalDocument,
    ClientPortalMessage,
    ClientPortalUpdate,
    Membership,
    Organization,
    User,
)
from app.services import jobs, rate_limit
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal
from app.services.tasks import (
    ClosedCaseTaskError,
    TaskCaseNotFoundError,
    TaskNotAllowedError,
    _active_organization,
    _member_case,
)

CaseNotFoundError = TaskCaseNotFoundError
PortalNotAllowedError = TaskNotAllowedError
ClosedCasePortalError = ClosedCaseTaskError

LINK_LIFETIME: Final = datetime.timedelta(days=30)
# Un enlace vencido hace menos de esto todavía sirve para pedir uno nuevo.
RENEW_GRACE: Final = datetime.timedelta(days=90)
PATH: Final = "/portal"
INVITE_TEMPLATE: Final = "client_portal_invite"
MESSAGE_TEMPLATE: Final = "client_portal_message"
NEWS_TEMPLATE: Final = "client_portal_news"
# Un cliente recibe como máximo un aviso de novedades por hora, sea cual sea el número de cambios.
NEWS_EMAIL_WINDOW_SECONDS: Final = 60 * 60
# Los avisos por correo de mensajes seguidos se juntan en uno por ventana.
MESSAGE_EMAIL_WINDOW_SECONDS: Final = 15 * 60
MAX_UPDATES: Final = 100
# Un despacho con el plan vencido queda en solo lectura: el cliente puede seguir leyendo y
# descargando, pero no escribir. Uno suspendido o cerrado corta el portal.
_READABLE_STATUSES: Final = ("active", "read_only")


class AccessNotFoundError(Exception):
    """El acceso no existe para ese caso."""


class NoticeNotAcceptedError(Exception):
    """El cliente todavía no aceptó el aviso de datos."""


@dataclass(frozen=True, slots=True)
class AccessView:
    access: ClientPortalAccess
    created_by_name: str

    @property
    def status(self) -> str:
        if self.access.revoked_at is not None:
            return "revoked"
        if self.access.expires_at <= _now():
            return "expired"
        return "active"


@dataclass(frozen=True, slots=True)
class UpdateView:
    update: ClientPortalUpdate
    author_name: str


@dataclass(frozen=True, slots=True)
class PublicUpdate:
    id: uuid.UUID
    author_name: str
    body: str
    created_at: datetime.datetime


@dataclass(frozen=True, slots=True)
class PublicDocument:
    id: uuid.UUID
    filename: str
    size_bytes: int
    created_at: datetime.datetime


@dataclass(frozen=True, slots=True)
class PublicMessage:
    id: uuid.UUID
    body: str
    created_at: datetime.datetime


@dataclass(frozen=True, slots=True)
class MessageView:
    message: ClientPortalMessage
    client_name: str


@dataclass(frozen=True, slots=True)
class PublicView:
    organization_name: str
    client_name: str
    notice_accepted: bool
    case_title: str | None
    case_status: str | None
    updates: list[PublicUpdate]
    messages: list[PublicMessage]
    documents: list[PublicDocument]
    expires_at: datetime.datetime


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC)


def portal_link(settings: Settings, access: ClientPortalAccess) -> str:
    """El token va en el fragmento (#t=…): el navegador nunca lo envía al servidor."""
    token = issue_portal_link(
        settings.signing_key(),
        access.id,
        access.organization_id,
        access.link_version,
        access.expires_at,
    )
    return f"{settings.public_url}{PATH}#t={token}"


def _allowed(principal: Principal) -> None:
    if not has_permission(principal.role, "cases.manage_client_portal"):
        raise PortalNotAllowedError


def _audit(
    session: Session,
    organization_id: uuid.UUID,
    actor: uuid.UUID | None,
    action: str,
    target: uuid.UUID,
    details: dict[str, str],
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    session.add(
        AuditLog(
            organization_id=organization_id,
            actor_user_id=actor,
            action=action,
            target_id=target,
            details=details,
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
        )
    )
    session.flush()


def _enqueue_invite(session: Session, access: ClientPortalAccess, *, renewed: bool = False) -> None:
    jobs.enqueue(
        session,
        "email_send",
        {
            "template": INVITE_TEMPLATE,
            "access_id": str(access.id),
            "organization_id": str(access.organization_id),
            "renewed": renewed,
        },
        f"{INVITE_TEMPLATE}:{access.id}:{access.link_version}",
    )


def notify_clients(session: Session, case_id: uuid.UUID) -> None:
    """Avisa por correo a los clientes con acceso vigente que ya entraron al portal que hay
    novedades. No copia el contenido: dice que hay algo nuevo y lleva al portal. Se agrupa por
    hora para que varios cambios seguidos no llenen el correo del cliente."""
    now = _now()
    accesses = session.scalars(
        select(ClientPortalAccess).where(
            ClientPortalAccess.case_id == case_id,
            ClientPortalAccess.revoked_at.is_(None),
            ClientPortalAccess.expires_at > now,
            ClientPortalAccess.notice_accepted_at.is_not(None),
        )
    ).all()
    bucket = int(now.timestamp() // NEWS_EMAIL_WINDOW_SECONDS)
    for access in accesses:
        jobs.enqueue(
            session,
            "email_send",
            {
                "template": NEWS_TEMPLATE,
                "access_id": str(access.id),
                "organization_id": str(access.organization_id),
            },
            f"{NEWS_TEMPLATE}:{access.id}:{access.link_version}:{bucket}",
        )


def list_accesses(session: Session, principal: Principal, case_id: uuid.UUID) -> list[AccessView]:
    _allowed(principal)
    _member_case(session, principal, case_id, lock=False)
    rows = session.execute(
        select(ClientPortalAccess, User.full_name)
        .join(User, User.id == ClientPortalAccess.created_by)
        .where(ClientPortalAccess.case_id == case_id)
        .order_by(ClientPortalAccess.id.desc())
        .limit(50)
    ).all()
    return [AccessView(access, name) for access, name in rows]


def invite(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    *,
    name: str,
    email: str,
    client_ip: str,
    user_agent: str | None,
) -> AccessView:
    """Da acceso a un cliente. Si ya lo tiene, le reenvía el enlace y el anterior deja de
    servir. Un caso archivado conserva sus accesos, pero no admite nuevos."""
    _allowed(principal)
    rate_limit.hit(session, rate_limit.PORTAL_INVITE_ACCOUNT, str(principal.user_id))
    session.commit()
    with session.begin():
        case = _member_case(session, principal, case_id, lock=True)
        _active_organization(session, case.organization_id)
        if case.status != "open":
            raise ClosedCasePortalError
        email = email.strip().lower()
        existing = session.scalar(
            select(ClientPortalAccess)
            .where(
                ClientPortalAccess.case_id == case.id,
                ClientPortalAccess.client_email == email,
                ClientPortalAccess.revoked_at.is_(None),
            )
            .with_for_update()
        )
        now = _now()
        if existing is None:
            access = ClientPortalAccess(
                organization_id=case.organization_id,
                case_id=case.id,
                created_by=principal.user_id,
                client_name=name,
                client_email=email,
                expires_at=now + LINK_LIFETIME,
            )
            session.add(access)
        else:
            access = existing
            access.client_name = name
            access.link_version += 1
            access.expires_at = now + LINK_LIFETIME
        session.flush()
        _audit(
            session,
            case.organization_id,
            principal.user_id,
            "client_portal_invited",
            access.id,
            {"case_id": str(case.id), "version": str(access.link_version)},
            client_ip=client_ip,
            user_agent=user_agent,
        )
        _enqueue_invite(session, access)
        author = session.scalar(select(User.full_name).where(User.id == principal.user_id))
    return AccessView(access, author or "")


def revoke(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    access_id: uuid.UUID,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    _allowed(principal)
    session.commit()
    with session.begin():
        case = _member_case(session, principal, case_id, lock=True)
        access = session.scalar(
            select(ClientPortalAccess)
            .where(
                ClientPortalAccess.id == access_id,
                ClientPortalAccess.case_id == case.id,
            )
            .with_for_update()
        )
        if access is None:
            raise AccessNotFoundError
        if access.revoked_at is not None:
            return
        access.revoked_at = _now()
        access.revoked_by = principal.user_id
        _audit(
            session,
            case.organization_id,
            principal.user_id,
            "client_portal_revoked",
            access.id,
            {"case_id": str(case.id)},
            client_ip=client_ip,
            user_agent=user_agent,
        )


def list_updates(session: Session, principal: Principal, case_id: uuid.UUID) -> list[UpdateView]:
    _allowed(principal)
    _member_case(session, principal, case_id, lock=False)
    return _updates(session, case_id)


def _updates(session: Session, case_id: uuid.UUID) -> list[UpdateView]:
    rows = session.execute(
        select(ClientPortalUpdate, User.full_name)
        .join(User, User.id == ClientPortalUpdate.author_id)
        .where(ClientPortalUpdate.case_id == case_id)
        .order_by(ClientPortalUpdate.id.desc())
        .limit(MAX_UPDATES)
    ).all()
    return [UpdateView(update, name) for update, name in rows]


def publish_update(
    session: Session,
    principal: Principal,
    case_id: uuid.UUID,
    body: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> UpdateView:
    """Publica un aviso para el cliente. El texto no entra a la auditoría, solo su tamaño."""
    _allowed(principal)
    session.commit()
    with session.begin():
        case = _member_case(session, principal, case_id, lock=True)
        _active_organization(session, case.organization_id)
        if case.status != "open":
            raise ClosedCasePortalError
        update = ClientPortalUpdate(
            organization_id=case.organization_id,
            case_id=case.id,
            author_id=principal.user_id,
            body=body.strip(),
        )
        session.add(update)
        session.flush()
        _audit(
            session,
            case.organization_id,
            principal.user_id,
            "client_portal_update_published",
            update.id,
            {"case_id": str(case.id), "length": str(len(update.body))},
            client_ip=client_ip,
            user_agent=user_agent,
        )
        notify_clients(session, case.id)
        author = session.scalar(select(User.full_name).where(User.id == principal.user_id))
    return UpdateView(update, author or "")


def _live_access(
    session: Session, settings: Settings, token: str, *, lock: bool
) -> tuple[ClientPortalAccess, Case]:
    """Carga el acceso bajo RLS con la sola organización del token y comprueba que siga vivo."""
    claims = read_portal_link(settings.signing_key(), token)
    set_tenant(session, TenantContext(organization_id=claims.organization_id))
    query = (
        select(ClientPortalAccess, Case)
        .join(Case, Case.id == ClientPortalAccess.case_id)
        .join(Organization, Organization.id == ClientPortalAccess.organization_id)
        .where(
            ClientPortalAccess.id == claims.access_id,
            ClientPortalAccess.organization_id == claims.organization_id,
            ClientPortalAccess.link_version == claims.version,
            ClientPortalAccess.revoked_at.is_(None),
            ClientPortalAccess.expires_at > _now(),
            Case.status != "deleting",
            Organization.status.in_(_READABLE_STATUSES),
        )
    )
    if lock:
        query = query.with_for_update(of=ClientPortalAccess)
    row = session.execute(query).one_or_none()
    if row is None:
        raise InvalidPortalLinkError
    return row[0], row[1]


def view(session: Session, settings: Settings, token: str) -> PublicView:
    """Lo que ve el cliente. Hasta que acepte el aviso solo ve quién lo invitó."""
    access, case = _live_access(session, settings, token, lock=True)
    organization = session.get(Organization, access.organization_id)
    if organization is None:
        raise InvalidPortalLinkError
    access.last_visit_at = _now()
    accepted = access.notice_accepted_at is not None
    updates = [
        PublicUpdate(item.update.id, item.author_name, item.update.body, item.update.created_at)
        for item in (_updates(session, case.id) if accepted else [])
    ]
    documents = (
        [
            PublicDocument(row.id, row.filename, row.size_bytes, row.created_at)
            for row in session.scalars(
                select(ClientPortalDocument)
                .where(
                    ClientPortalDocument.case_id == case.id,
                    ClientPortalDocument.removed_at.is_(None),
                )
                .order_by(ClientPortalDocument.id.desc())
                .limit(MAX_UPDATES)
            )
        ]
        if accepted
        else []
    )
    messages = [
        PublicMessage(message.id, message.body, message.created_at)
        for message in (_own_messages(session, access.id) if accepted else [])
    ]
    result = PublicView(
        organization_name=organization.name,
        client_name=access.client_name,
        notice_accepted=accepted,
        case_title=case.title if accepted else None,
        case_status=case.status if accepted else None,
        updates=updates,
        messages=messages,
        documents=documents,
        expires_at=access.expires_at,
    )
    session.commit()
    return result


def accept_notice(
    session: Session,
    settings: Settings,
    token: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """El cliente acepta el aviso de tratamiento de datos. Se registra una sola vez."""
    access, _ = _live_access(session, settings, token, lock=True)
    if access.notice_accepted_at is not None:
        return
    access.notice_accepted_at = _now()
    _audit(
        session,
        access.organization_id,
        None,
        "client_portal_notice_accepted",
        access.id,
        {"case_id": str(access.case_id)},
        client_ip=client_ip,
        user_agent=user_agent,
    )
    session.commit()


def renew(
    session: Session,
    settings: Settings,
    token: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    """Manda un enlace nuevo al correo con que se invitó al cliente. Sirve con el enlace más
    reciente aunque haya vencido (hasta 90 días) y nunca con uno ya reemplazado, y el correo
    va siempre a la dirección registrada, no a quien lo pide."""
    claims = read_portal_link(settings.signing_key(), token, grace=RENEW_GRACE)
    set_tenant(session, TenantContext(organization_id=claims.organization_id))
    access = session.scalar(
        select(ClientPortalAccess)
        .join(Case, Case.id == ClientPortalAccess.case_id)
        .where(
            ClientPortalAccess.id == claims.access_id,
            ClientPortalAccess.organization_id == claims.organization_id,
            ClientPortalAccess.link_version == claims.version,
            ClientPortalAccess.revoked_at.is_(None),
            Case.status == "open",
        )
        .with_for_update(of=ClientPortalAccess)
    )
    organization = session.get(Organization, claims.organization_id)
    if access is None or organization is None or organization.status not in _READABLE_STATUSES:
        raise InvalidPortalLinkError
    rate_limit.hit(session, rate_limit.PORTAL_RENEW_ACCESS, str(access.id))
    access.link_version += 1
    access.expires_at = _now() + LINK_LIFETIME
    session.flush()
    _audit(
        session,
        access.organization_id,
        None,
        "client_portal_renewed",
        access.id,
        {"case_id": str(access.case_id), "version": str(access.link_version)},
        client_ip=client_ip,
        user_agent=user_agent,
    )
    _enqueue_invite(session, access, renewed=True)
    session.commit()


def _own_messages(session: Session, access_id: uuid.UUID) -> list[ClientPortalMessage]:
    """Los mensajes que escribió este cliente, del más reciente al más antiguo."""
    return list(
        session.scalars(
            select(ClientPortalMessage)
            .where(ClientPortalMessage.access_id == access_id)
            .order_by(ClientPortalMessage.id.desc())
            .limit(MAX_UPDATES)
        )
    )


def send_message(
    session: Session,
    settings: Settings,
    token: str,
    body: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> PublicMessage:
    """El cliente le escribe al despacho. Avisa por correo, sin copiar el texto, a los dueños y
    abogados del caso; los mensajes seguidos se juntan en un solo aviso por cada 15 minutos."""
    access, case = _live_access(session, settings, token, lock=True)
    if access.notice_accepted_at is None:
        raise NoticeNotAcceptedError
    organization = session.get(Organization, access.organization_id)
    if organization is None or organization.status != "active":
        raise InvalidPortalLinkError
    if case.status != "open":
        raise ClosedCasePortalError
    rate_limit.hit(session, rate_limit.PORTAL_MESSAGE_ACCESS, str(access.id))
    message = ClientPortalMessage(
        organization_id=access.organization_id,
        case_id=case.id,
        access_id=access.id,
        body=body.strip(),
    )
    session.add(message)
    session.flush()
    _audit(
        session,
        access.organization_id,
        None,
        "client_portal_message_sent",
        message.id,
        {"case_id": str(case.id), "length": str(len(message.body))},
        client_ip=client_ip,
        user_agent=user_agent,
    )
    recipients = session.scalars(
        select(Membership.user_id)
        .join(CaseMember, CaseMember.user_id == Membership.user_id)
        .where(
            CaseMember.case_id == case.id,
            Membership.organization_id == access.organization_id,
            Membership.role.in_(("owner", "lawyer")),
        )
    ).all()
    bucket = int(_now().timestamp() // MESSAGE_EMAIL_WINDOW_SECONDS)
    for user_id in recipients:
        jobs.enqueue(
            session,
            "email_send",
            {
                "template": MESSAGE_TEMPLATE,
                "user_id": str(user_id),
                "case_id": str(case.id),
                "organization_id": str(access.organization_id),
                "access_id": str(access.id),
            },
            f"{MESSAGE_TEMPLATE}:{access.id}:{user_id}:{bucket}",
        )
    result = PublicMessage(message.id, message.body, message.created_at)
    session.commit()
    return result


def list_messages(session: Session, principal: Principal, case_id: uuid.UUID) -> list[MessageView]:
    _allowed(principal)
    _member_case(session, principal, case_id, lock=False)
    rows = session.execute(
        select(ClientPortalMessage, ClientPortalAccess.client_name)
        .join(ClientPortalAccess, ClientPortalAccess.id == ClientPortalMessage.access_id)
        .where(ClientPortalMessage.case_id == case_id)
        .order_by(ClientPortalMessage.id.desc())
        .limit(MAX_UPDATES)
    ).all()
    return [MessageView(message, name) for message, name in rows]


def mark_messages_read(session: Session, principal: Principal, case_id: uuid.UUID) -> None:
    _allowed(principal)
    session.commit()
    with session.begin():
        case = _member_case(session, principal, case_id, lock=False)
        session.execute(
            update(ClientPortalMessage)
            .where(ClientPortalMessage.case_id == case.id, ClientPortalMessage.read_at.is_(None))
            .values(read_at=_now())
        )
