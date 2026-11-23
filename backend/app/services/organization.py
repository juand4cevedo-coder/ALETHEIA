"""Los datos propios del despacho: hoy, solo su nombre (API-022)."""

import datetime

from sqlalchemy.orm import Session

from app.models import AuditLog, Organization
from app.repositories.organization import organization_for_update
from app.services.audit import audit_ip, audit_user_agent
from app.services.sessions import Principal


def rename(
    session: Session,
    principal: Principal,
    name: str,
    *,
    client_ip: str,
    user_agent: str | None,
) -> Organization:
    """Cambia el nombre del despacho. Repetir el mismo nombre no deja otro evento."""
    organization_id = principal.organization_id
    if organization_id is None:
        msg = "get_owner ya exige una organización"
        raise LookupError(msg)
    organization = organization_for_update(session, organization_id)
    if organization is None:
        msg = "La organización de la sesión desapareció"
        raise LookupError(msg)
    if organization.name != name:
        organization.name = name
        session.add(
            AuditLog(
                organization_id=organization_id,
                actor_user_id=principal.user_id,
                action="organization_renamed",
                target_id=organization_id,
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
                created_at=datetime.datetime.now(datetime.UTC),
            )
        )
    session.commit()
    session.refresh(organization)
    return organization


def update_policies(
    session: Session,
    principal: Principal,
    *,
    default_retention_years: int,
    session_days: int,
    client_ip: str,
    user_agent: str | None,
) -> Organization:
    """Cambia las políticas del despacho. Si nada cambia, no deja evento de auditoría."""
    organization_id = principal.organization_id
    if organization_id is None:
        msg = "get_owner ya exige una organización"
        raise LookupError(msg)
    organization = organization_for_update(session, organization_id)
    if organization is None:
        msg = "La organización de la sesión desapareció"
        raise LookupError(msg)
    previous = {
        "default_retention_years": organization.default_retention_years,
        "session_days": organization.session_days,
    }
    current = {"default_retention_years": default_retention_years, "session_days": session_days}
    if previous != current:
        organization.default_retention_years = default_retention_years
        organization.session_days = session_days
        session.add(
            AuditLog(
                organization_id=organization_id,
                actor_user_id=principal.user_id,
                action="organization_policy_changed",
                target_id=organization_id,
                ip=audit_ip(client_ip),
                user_agent=audit_user_agent(user_agent),
                details={"previous": previous, "current": current},
                created_at=datetime.datetime.now(datetime.UTC),
            )
        )
    session.commit()
    return organization
