"""Cierre de cuenta: corta el acceso y minimiza identidad sin borrar expedientes retenidos."""

import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core.passwords import check_password
from app.models import (
    AuditLog,
    Invitation,
    Membership,
    OAuthIdentity,
    Organization,
    PaymentSource,
    Subscription,
    User,
)
from app.repositories import organization as organization_repository
from app.repositories import sessions as sessions_repository
from app.services import rate_limit
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal


class WrongPasswordError(Exception):
    pass


class OwnerTransferRequiredError(Exception):
    pass


class PlatformOwnerCannotCloseError(Exception):
    pass


def close_account(
    session: Session,
    principal: Principal,
    password: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> None:
    user = session.get(User, principal.user_id, with_for_update=True)
    if user is None or user.status != "active":
        raise WrongPasswordError
    if user.is_platform_admin:
        raise PlatformOwnerCannotCloseError

    rate_limit.check(session, rate_limit.LOGIN_ACCOUNT, user.email)
    if not check_password(user.password_hash, password):
        rate_limit.record(session, rate_limit.LOGIN_ACCOUNT, user.email)
        session.commit()
        raise WrongPasswordError

    membership = session.scalar(
        select(Membership).where(Membership.user_id == user.id).with_for_update()
    )
    organization_id = membership.organization_id if membership is not None else None
    if membership is not None and membership.role == "owner":
        if organization_repository.member_count(session, membership.organization_id) > 1:
            session.rollback()
            raise OwnerTransferRequiredError
        organization = session.get(Organization, membership.organization_id, with_for_update=True)
        if organization is not None:
            organization.status = "closed"
        subscription = session.scalar(
            select(Subscription)
            .where(Subscription.organization_id == membership.organization_id)
            .with_for_update()
        )
        if subscription is not None:
            subscription.status = "canceled"
            subscription.pending_checkout_reference = None
        now = datetime.datetime.now(datetime.UTC)
        session.execute(
            update(Invitation)
            .where(
                Invitation.organization_id == membership.organization_id,
                Invitation.accepted_at.is_(None),
                Invitation.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
        # Cerrar el despacho cancela la renovación automática: nada se cobra después de cerrar.
        session.execute(
            update(PaymentSource)
            .where(
                PaymentSource.organization_id == membership.organization_id,
                PaymentSource.status.in_(("pending", "active")),
            )
            .values(status="canceled", canceled_at=now, canceled_by=user.id)
        )
    else:
        now = datetime.datetime.now(datetime.UTC)

    # El evento se escribe antes de retirar la membresía. La fila de usuario permanece como
    # seudónimo para que autorías y cadena de custodia históricas no se reescriban.
    session.add(
        AuditLog(
            organization_id=organization_id,
            actor_user_id=user.id,
            action="account_closed",
            target_id=user.id,
            details={"identity": "anonymized", "case_records": "preserved"},
            ip=audit_ip(client_ip),
            user_agent=audit_user_agent(user_agent),
            created_at=now,
        )
    )
    session.flush()
    if membership is not None:
        session.delete(membership)
    session.execute(delete(OAuthIdentity).where(OAuthIdentity.user_id == user.id))
    sessions_repository.revoke_user_sessions(session, user.id, now)
    rate_limit.clear(session, rate_limit.LOGIN_ACCOUNT, user.email)
    # La función SECURITY DEFINER solo admite la persona fijada en app_user_id(), usa valores
    # de anonimización constantes y rechaza a la cuenta de plataforma. Así la aplicación no
    # recibe permiso general para editar nombres o el atributo administrativo de users.
    session.execute(select(func.anonymize_own_user(user.id)))
    session.commit()
