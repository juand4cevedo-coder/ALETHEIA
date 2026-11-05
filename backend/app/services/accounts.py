"""Registro de cuentas (RF-006, HU-005).

Una cuenta nueva nace con su organización, la persona como propietaria y la prueba gratis, todo
en una sola transacción: si algo falla, no queda nada a medias.

Para no revelar qué correos existen (CA-HU-005-03), un correo ya registrado recibe la misma
respuesta y pasa por el mismo hash de contraseña que uno nuevo, así que tampoco el tiempo de
respuesta delata la cuenta. Al dueño de ese correo le llega un aviso, con el tope por dirección
de RNF-006 para que nadie use el registro como forma de llenarle la bandeja.
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
from app.services import rate_limit, verification
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
    existing = accounts_repository.user_by_email(session, request.email)
    if existing is not None:
        _notify_existing_account(session, existing.id, request.email)
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
            organization=Organization(id=organization_id, name=_organization_name(request)),
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
        # El correo de verificación sale solo si la cuenta queda creada: va en la misma transacción.
        verification.enqueue_verification(session, user_id)
        session.commit()
    except IntegrityError as exc:
        # Otra petición registró el mismo correo un instante antes: para quien llama, es igual
        # que un correo ya registrado.
        session.rollback()
        if _UNIQUE_EMAIL not in str(exc.orig):
            raise


def _notify_existing_account(session: Session, user_id: uuid.UUID, email: str) -> None:
    try:
        rate_limit.hit(session, rate_limit.EMAIL_VERIFICATION_ACCOUNT, email)
    except rate_limit.RateLimitExceededError:
        # Sin aviso, pero con la misma respuesta: quien registra no debe notar la diferencia.
        session.rollback()
        return
    verification.enqueue_account_exists(session, user_id)
    session.commit()


def resend_verification(session: Session, email: str, *, client_ip: str) -> None:
    """Reenvía el enlace si hay una cuenta con ese correo todavía sin verificar.

    Los dos topes cuentan toda petición, exista o no la cuenta, así que el 429 tampoco revela
    nada.
    """
    rate_limit.hit(session, rate_limit.EMAIL_VERIFICATION_IP, client_ip)
    rate_limit.hit(session, rate_limit.EMAIL_VERIFICATION_ACCOUNT, email)
    user = accounts_repository.user_by_email(session, email)
    if user is not None and user.email_verified_at is None:
        verification.enqueue_verification(session, user.id)
    session.commit()


def _organization_name(request: RegisterRequest) -> str:
    # Quien trabaja por su cuenta es una organización de una persona, con su propio nombre;
    # podrá cambiarlo cuando exista la configuración de la organización.
    if request.organization_name is None:
        return request.full_name
    return request.organization_name


def _valid_ip(value: str) -> str | None:
    # La columna es INET: lo que no sea una IP, como el cliente de las pruebas, no se guarda.
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None
