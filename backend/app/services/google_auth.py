"""Vinculación y acceso con una identidad de Google ya verificada por OIDC."""

import datetime
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.adapters.google_oidc import GoogleIdentity
from app.core.config import Settings
from app.core.legal import LEGAL_VERSION
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, OAuthIdentity, Organization, Subscription, User
from app.repositories import accounts as accounts_repository
from app.repositories import sessions as sessions_repository
from app.services import rate_limit, subscription_expiration
from app.services.audit import audit_ip, audit_user_agent
from app.services.legal import LegalVersionMismatchError, record_registration
from app.services.plans import TRIAL_DAYS, TRIAL_PLAN_CODE
from app.services.sessions import (
    IssuedSession,
    SecondFactorRequiredError,
    has_second_factor,
    second_factor_challenge,
    start_session,
)


class GoogleIdentityNotLinkedError(Exception):
    pass


class GoogleIdentityAlreadyLinkedError(Exception):
    pass


class GoogleLinkSessionEndedError(Exception):
    pass


class GoogleAccountBlockedError(Exception):
    pass


class GoogleRegistrationEmailInUseError(Exception):
    pass


class GoogleAccountMissingError(Exception):
    """La identidad de Google no está vinculada y su correo no tiene cuenta: toca registrarse."""


def register(
    session: Session,
    settings: Settings,
    identity: GoogleIdentity,
    *,
    account_type: str,
    organization_name: str | None,
    legal_version: str,
    client_ip: str,
    user_agent: str | None,
) -> IssuedSession:
    """Crea una cuenta sin contraseña desde una identidad verificada y abre su sesión."""
    if legal_version != LEGAL_VERSION:
        raise LegalVersionMismatchError
    rate_limit.hit(session, rate_limit.REGISTER_IP, client_ip)
    session.commit()

    existing_identity = accounts_repository.google_identity_by_subject(session, identity.subject)
    if existing_identity is not None:
        return login(
            session,
            settings,
            identity.subject,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    if accounts_repository.user_by_email(session, identity.email) is not None:
        raise GoogleRegistrationEmailInUseError

    now = datetime.datetime.now(datetime.UTC)
    user_id, organization_id = uuid.uuid7(), uuid.uuid7()
    trial_plan_id = accounts_repository.plan_id_by_code(session, TRIAL_PLAN_CODE)
    organization_display_name = (
        identity.full_name if account_type == "individual" else organization_name
    )
    if organization_display_name is None:
        raise ValueError("El registro de una firma exige el nombre de la organización.")
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=user_id))
    user = User(
        id=user_id,
        email=identity.email,
        email_verified_at=now,
        password_hash=None,
        full_name=identity.full_name,
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=now,
    )
    try:
        accounts_repository.add_account(
            session,
            user=user,
            organization=Organization(
                id=organization_id, name=organization_display_name, kind=account_type
            ),
            subscription=Subscription(
                organization_id=organization_id,
                plan_id=trial_plan_id,
                status="trial",
                billing_cycle="none",
                access_source="trial",
                trial_ends_at=now + datetime.timedelta(days=TRIAL_DAYS),
            ),
            audit=AuditLog(
                organization_id=organization_id,
                actor_user_id=user_id,
                action="user_registered",
                target_id=user_id,
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
                created_at=now,
            ),
        )
        session.add(OAuthIdentity(user_id=user_id, provider="google", subject=identity.subject))
        record_registration(session, user)
        subscription_expiration.schedule(
            session, organization_id, now + datetime.timedelta(days=TRIAL_DAYS)
        )
        issued = start_session(
            session,
            settings,
            user_id,
            organization_id,
            client_ip=client_ip,
            user_agent=user_agent,
            now=now,
        )
        session.commit()
        return issued
    except IntegrityError:
        session.rollback()
        raise GoogleRegistrationEmailInUseError from None


def login(
    session: Session,
    settings: Settings,
    subject: str,
    *,
    email: str | None = None,
    client_ip: str,
    user_agent: str | None,
) -> IssuedSession:
    identity = accounts_repository.google_identity_by_subject(session, subject)
    if identity is None:
        # Google ya comprobó que la persona controla ese correo, así que decirle si tiene cuenta
        # no revela nada a un tercero. Nunca se vincula sola por coincidir el correo (RN-024).
        if email is not None and accounts_repository.user_by_email(session, email) is None:
            raise GoogleAccountMissingError
        raise GoogleIdentityNotLinkedError
    user = session.get(User, identity.user_id)
    if user is None:
        raise GoogleIdentityNotLinkedError
    if user.status != "active":
        raise GoogleAccountBlockedError
    if has_second_factor(session, user.id):
        raise SecondFactorRequiredError(second_factor_challenge(settings, user))
    set_tenant(session, TenantContext(user_id=user.id))
    membership = (
        None if user.is_platform_admin else accounts_repository.membership_of(session, user.id)
    )
    organization_id = membership.organization_id if membership is not None else None
    set_tenant(
        session,
        TenantContext(organization_id=organization_id, user_id=user.id),
    )
    now = datetime.datetime.now(datetime.UTC)
    issued = start_session(
        session,
        settings,
        user.id,
        organization_id,
        client_ip=client_ip,
        user_agent=user_agent,
        now=now,
    )
    session.commit()
    return issued


def link(
    session: Session,
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    subject: str,
    client_ip: str,
    user_agent: str | None,
) -> None:
    if sessions_repository.accepted_legal_version(session, user_id, session_id) is None:
        raise GoogleLinkSessionEndedError
    existing = accounts_repository.google_identity_by_subject(session, subject)
    if existing is not None:
        if existing.user_id == user_id:
            return
        raise GoogleIdentityAlreadyLinkedError
    if accounts_repository.has_google_identity(session, user_id):
        return
    set_tenant(session, TenantContext(user_id=user_id))
    membership = accounts_repository.membership_of(session, user_id)
    organization_id = membership.organization_id if membership is not None else None
    set_tenant(
        session,
        TenantContext(organization_id=organization_id, user_id=user_id),
    )
    now = datetime.datetime.now(datetime.UTC)
    session.add(OAuthIdentity(user_id=user_id, provider="google", subject=subject))
    session.add(
        AuditLog(
            organization_id=organization_id,
            actor_user_id=user_id,
            action="google_linked",
            target_id=user_id,
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
            created_at=now,
        )
    )
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise GoogleIdentityAlreadyLinkedError from None
