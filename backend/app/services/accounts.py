"""Registro de cuentas (RF-006, HU-005).

Una cuenta nueva nace con su organización, la persona como propietaria y la prueba gratis, todo
en una sola transacción: si algo falla, no queda nada a medias.

Para no revelar qué correos existen (CA-HU-005-03), un correo ya registrado recibe la misma
respuesta y pasa por el mismo hash de contraseña que uno nuevo, así que tampoco el tiempo de
respuesta delata la cuenta. El aviso al dueño de ese correo llega con HU-006.
"""

import datetime
import ipaddress
import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.legal import LEGAL_VERSION
from app.core.passwords import hash_password
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Organization, Subscription, User
from app.repositories import accounts as accounts_repository
from app.schemas.auth import RegisterRequest
from app.services import rate_limit
from app.services.plans import TRIAL_DAYS, TRIAL_PLAN_CODE

_UNIQUE_EMAIL = "uq_users_email_lower"
_USER_AGENT_MAX = 300


class LegalVersionMismatchError(Exception):
    """La persona aceptó una versión de los textos legales que ya no es la vigente."""


def register(
    session: Session, request: RegisterRequest, *, client_ip: str, user_agent: str | None
) -> None:
    """Crea la cuenta si el correo está libre; si no, no hace nada visible desde fuera."""
    # El intento cuenta aunque después falle, así que va en su propia transacción.
    rate_limit.hit(session, rate_limit.REGISTER_IP, client_ip)
    session.commit()

    if request.legal_version != LEGAL_VERSION:
        raise LegalVersionMismatchError
    password_hash = hash_password(request.password)
    if accounts_repository.email_taken(session, request.email):
        return

    now = datetime.datetime.now(datetime.UTC)
    user_id, organization_id = uuid.uuid7(), uuid.uuid7()
    trial_plan_id = accounts_repository.plan_id_by_code(session, TRIAL_PLAN_CODE)
    set_tenant(session, TenantContext(organization_id=organization_id, user_id=user_id))
    try:
        accounts_repository.add_account(
            session,
            user=User(
                id=user_id,
                email=request.email,
                password_hash=password_hash,
                full_name=request.full_name,
                terms_version=LEGAL_VERSION,
                privacy_version=LEGAL_VERSION,
                consented_at=now,
            ),
            organization=Organization(id=organization_id, name=request.organization_name),
            subscription=Subscription(
                organization_id=organization_id,
                plan_id=trial_plan_id,
                status="trial",
                billing_cycle="none",
                trial_ends_at=now + datetime.timedelta(days=TRIAL_DAYS),
            ),
            audit=AuditLog(
                organization_id=organization_id,
                actor_user_id=user_id,
                action="user_registered",
                target_id=user_id,
                ip=_valid_ip(client_ip),
                user_agent=user_agent[:_USER_AGENT_MAX] if user_agent else None,
                created_at=now,
            ),
        )
        session.commit()
    except IntegrityError as exc:
        # Otra petición registró el mismo correo un instante antes: para quien llama, es igual
        # que un correo ya registrado.
        session.rollback()
        if _UNIQUE_EMAIL not in str(exc.orig):
            raise


def _valid_ip(value: str) -> str | None:
    # La columna es INET: lo que no sea una IP, como el cliente de las pruebas, no se guarda.
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None
