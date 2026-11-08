"""Abrir y aceptar una invitación (RF-015, HU-012, ADR-036).

El enlace trae un token opaco; se busca por su SHA-256 con invitation_for_token, que entrega la
organización, y desde ahí todo pasa por Row-Level Security como cualquier petición. Una
invitación vencida, revocada, ya usada o inexistente da el mismo error (CA-HU-012-02).

Quien acepta crea su cuenta con nombre y contraseña o, si ya tiene una sin organización,
demuestra que es suya con su contraseña. El correo queda verificado, porque abrir el enlace
prueba que la persona lo controla. Una persona pertenece a una sola organización (RN-011,
CA-HU-012-03). Al aceptar entra de una vez a su espacio de trabajo. El ingreso con Google
llega con HU-008.
"""

import datetime
import uuid
from dataclasses import dataclass
from typing import Final, Literal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.legal import LEGAL_VERSION
from app.core.passwords import check_password, hash_password
from app.core.tokens import opaque_token_hash
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Invitation, Membership, Organization, User
from app.repositories import accounts as accounts_repository
from app.repositories import organization as organization_repository
from app.services import rate_limit
from app.services.audit import audit_ip, audit_user_agent
from app.services.legal import LegalVersionMismatchError, record_registration
from app.services.sessions import IssuedSession, start_session

# Un token legítimo mide 43 caracteres: lo demás se rechaza sin calcular hashes.
MAX_TOKEN_LENGTH: Final = 64

type AccountState = Literal["new", "existing", "member_elsewhere"]


class InvalidInvitationError(Exception):
    """El enlace no sirve: no existe, venció, se revocó o ya se usó. Siempre el mismo error."""


class MemberElsewhereError(Exception):
    """El correo ya pertenece a una organización (RN-011)."""


class OrganizationNotActiveError(Exception):
    """La organización que invita está en solo lectura o suspendida."""


class WrongPasswordError(Exception):
    """La cuenta existe y la contraseña no es la suya."""


class MissingAccountDataError(Exception):
    """Para una cuenta nueva faltan el nombre o la aceptación de los textos legales."""


@dataclass(frozen=True, slots=True)
class InvitationPreview:
    """Lo que la pantalla de aceptación muestra antes de aceptar (UI-011)."""

    organization_name: str
    inviter_name: str
    email: str
    role: str
    expires_at: datetime.datetime
    account: AccountState


@dataclass(frozen=True, slots=True)
class AcceptedInvitation:
    """La sesión abierta al aceptar y a dónde entró la persona."""

    session: IssuedSession
    organization_name: str
    role: str


@dataclass(frozen=True, slots=True)
class NewAccount:
    """Datos de la cuenta nueva que nace con la invitación."""

    full_name: str
    legal_version: str


def preview(session: Session, token: str, *, client_ip: str) -> InvitationPreview:
    """La invitación del enlace con su organización, quién invitó y el estado de la cuenta del
    correo invitado (API-052). No cambia nada."""
    rate_limit.hit(session, rate_limit.INVITATION_LINK_IP, client_ip)
    session.commit()
    invitation, organization = _open_invitation(session, token, lock=False)
    inviter = session.get(User, invitation.invited_by)
    existing = accounts_repository.user_by_email(session, invitation.email)
    result = InvitationPreview(
        organization_name=organization.name,
        inviter_name=inviter.full_name if inviter is not None else organization.name,
        email=invitation.email,
        role=invitation.role,
        expires_at=invitation.expires_at,
        account=_account_state(session, existing, invitation.organization_id),
    )
    session.rollback()
    return result


def accept(
    session: Session,
    settings: Settings,
    token: str,
    password: str,
    new_account: NewAccount | None,
    *,
    client_ip: str,
    user_agent: str | None,
) -> AcceptedInvitation:
    """Acepta la invitación, crea la membresía con su rol y abre la sesión (API-019).

    new_account trae el nombre y la aceptación de los textos cuando el correo no tiene cuenta;
    si la tiene, basta su contraseña, con el mismo tope de fallos del ingreso.
    """
    rate_limit.hit(session, rate_limit.INVITATION_LINK_IP, client_ip)
    session.commit()
    settings.signing_key()  # Sin clave no hay sesión: falla antes de tocar nada.

    invitation, organization = _open_invitation(session, token, lock=True)
    if organization.status != "active":
        session.rollback()
        raise OrganizationNotActiveError
    now = datetime.datetime.now(datetime.UTC)
    existing = accounts_repository.user_by_email(session, invitation.email)
    if existing is not None:
        user = _existing_account(session, existing, invitation, password, now)
    else:
        user = _new_account(session, invitation, password, new_account, now)

    set_tenant(session, TenantContext(organization_id=organization.id, user_id=user.id))
    try:
        organization_repository.add_membership(
            session,
            Membership(organization_id=organization.id, user_id=user.id, role=invitation.role),
        )
    except IntegrityError:
        # Otra invitación de otra organización se aceptó con este correo un instante antes.
        session.rollback()
        raise MemberElsewhereError from None
    invitation.accepted_at = now
    if existing is None:
        _audit(
            session,
            organization.id,
            user.id,
            "user_registered",
            user.id,
            client_ip,
            user_agent,
            now,
        )
    _audit(
        session,
        organization.id,
        user.id,
        "invitation_accepted",
        invitation.id,
        client_ip,
        user_agent,
        now,
    )
    issued = start_session(
        session,
        settings,
        user.id,
        organization.id,
        client_ip=client_ip,
        user_agent=user_agent,
        now=now,
    )
    session.commit()
    return AcceptedInvitation(
        session=issued, organization_name=organization.name, role=invitation.role
    )


def _open_invitation(
    session: Session, token: str, *, lock: bool
) -> tuple[Invitation, Organization]:
    if not token or len(token) > MAX_TOKEN_LENGTH:
        raise InvalidInvitationError
    found = organization_repository.invitation_for_token(session, opaque_token_hash(token))
    if found is None:
        session.rollback()
        raise InvalidInvitationError
    invitation_id, organization_id = found
    set_tenant(session, TenantContext(organization_id=organization_id))
    invitation = (
        organization_repository.invitation_for_update(session, invitation_id)
        if lock
        else session.get(Invitation, invitation_id)
    )
    organization = session.get(Organization, organization_id)
    now = datetime.datetime.now(datetime.UTC)
    if (
        invitation is None
        or organization is None
        or invitation.accepted_at is not None
        or invitation.revoked_at is not None
        or invitation.expires_at <= now
    ):
        session.rollback()
        raise InvalidInvitationError
    return invitation, organization


def _account_state(session: Session, user: User | None, organization_id: uuid.UUID) -> AccountState:
    if user is None:
        return "new"
    # La membresía propia solo se ve con la persona en el contexto (política own_membership).
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=user.id))
    membership = accounts_repository.membership_of(session, user.id)
    return "existing" if membership is None else "member_elsewhere"


def _existing_account(
    session: Session,
    user: User,
    invitation: Invitation,
    password: str,
    now: datetime.datetime,
) -> User:
    if _account_state(session, user, invitation.organization_id) == "member_elsewhere":
        session.rollback()
        raise MemberElsewhereError
    rate_limit.check(session, rate_limit.LOGIN_ACCOUNT, user.email)
    if user.status != "active" or not check_password(user.password_hash, password):
        rate_limit.record(session, rate_limit.LOGIN_ACCOUNT, user.email)
        session.commit()
        raise WrongPasswordError
    rate_limit.clear(session, rate_limit.LOGIN_ACCOUNT, user.email)
    if user.email_verified_at is None:
        user.email_verified_at = now
    return user


def _new_account(
    session: Session,
    invitation: Invitation,
    password: str,
    new_account: NewAccount | None,
    now: datetime.datetime,
) -> User:
    if new_account is None:
        session.rollback()
        raise MissingAccountDataError
    if new_account.legal_version != LEGAL_VERSION:
        session.rollback()
        raise LegalVersionMismatchError
    user = User(
        id=uuid.uuid7(),
        email=invitation.email,
        password_hash=hash_password(password),
        full_name=new_account.full_name,
        email_verified_at=now,
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=now,
    )
    try:
        session.add(user)
        session.flush()
    except IntegrityError:
        # Alguien registró este correo un instante antes: ya tiene su propia organización.
        session.rollback()
        raise MemberElsewhereError from None
    # La prueba de la aceptación nace con la cuenta (Ley 1581 de 2012, art. 9).
    record_registration(session, user)
    return user


def _audit(
    session: Session,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    action: str,
    target_id: uuid.UUID,
    client_ip: str,
    user_agent: str | None,
    now: datetime.datetime,
) -> None:
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=user_id))
    session.add(
        AuditLog(
            organization_id=organization_id,
            actor_user_id=user_id,
            action=action,
            target_id=target_id,
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
            created_at=now,
        )
    )
    session.flush()
