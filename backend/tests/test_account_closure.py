"""Cierre de cuenta con anonimización y conservación de registros históricos."""

import datetime
import uuid

import httpx2
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.core.legal import LEGAL_VERSION
from app.core.passwords import hash_password
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Membership, OAuthIdentity, Organization, PaymentSource, User
from app.services.sessions import Principal
from tests.conftest import NuevoCliente

_PASSWORD = "una frase larga y fácil"  # noqa: S105 -- credencial ficticia
_HASH = hash_password(_PASSWORD)


def _user(db: Session, email: str, *, platform_admin: bool = False) -> User:
    user = User(
        email=email,
        password_hash=_HASH,
        full_name="Ana Restrepo",
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
        **({"is_platform_admin": True} if platform_admin else {}),
    )
    db.add(user)
    db.flush()
    return user


def _organization(
    db: Session, *, with_member: bool = False
) -> tuple[User, User | None, Organization]:
    owner = _user(db, "duena@example.com")
    member = _user(db, "abogada@example.com") if with_member else None
    organization = Organization(id=uuid.uuid7(), name="Restrepo Abogados")
    set_tenant(db, TenantContext(organization_id=organization.id, user_id=owner.id))
    db.add(organization)
    db.flush()
    db.add(Membership(organization_id=organization.id, user_id=owner.id, role="owner"))
    if member is not None:
        db.add(Membership(organization_id=organization.id, user_id=member.id, role="lawyer"))
    db.commit()
    set_tenant(db, TenantContext())
    return owner, member, organization


def _login(device: NuevoCliente, email: str) -> TestClient:
    client = device()
    response = client.post("/api/v1/auth/login", json={"email": email, "password": _PASSWORD})
    assert response.status_code == 204
    return client


def _close(client: TestClient, password: str = _PASSWORD) -> httpx2.Response:
    return client.post(
        "/api/v1/me/account/closure",
        json={"password": password, "confirmation": "CERRAR MI CUENTA"},
    )


def test_propietaria_unica_cierra_acceso_y_organizacion_sin_borrar_historia(
    dispositivo: NuevoCliente, db: Session
) -> None:
    owner, _, organization = _organization(db)
    set_tenant(db, TenantContext(user_id=owner.id))
    db.add(OAuthIdentity(user_id=owner.id, provider="google", subject="google-ana"))
    # El id sale de la membresía: tocar `organization` aquí la recargaría sin el contexto de la
    # organización, que la política de filas no deja ver.
    organization_id = db.scalar(
        select(Membership.organization_id).where(Membership.user_id == owner.id)
    )
    assert organization_id is not None
    set_tenant(db, TenantContext(organization_id=organization_id, user_id=owner.id))
    ahora = datetime.datetime.now(datetime.UTC)
    db.add(
        PaymentSource(
            organization_id=organization_id,
            created_by=owner.id,
            kind="nequi",
            status="active",
            gateway_source_id=3891,
            phone_last4="4567",
            consent_version="2026-11-24",
            consent_accepted_at=ahora,
            linked_at=ahora,
        )
    )
    db.flush()
    # Se vuelve al contexto de la persona, como en el resto de la prueba.
    set_tenant(db, TenantContext(user_id=owner.id))
    db.commit()
    client = _login(dispositivo, owner.email)

    response = _close(client)

    assert response.status_code == 204
    assert client.get("/api/v1/me").status_code == 401
    db.refresh(owner)
    db.refresh(organization)
    assert owner.status == "closed"
    assert owner.full_name == "Cuenta cerrada"
    assert owner.email.endswith("@deleted.invalid")
    assert owner.password_hash is None
    assert organization.status == "closed"
    assert db.scalar(select(Membership.id).where(Membership.user_id == owner.id)) is None
    assert db.scalar(select(OAuthIdentity.id).where(OAuthIdentity.user_id == owner.id)) is None
    audit = db.scalar(select(AuditLog).where(AuditLog.action == "account_closed"))
    assert audit is not None
    assert audit.details == {"identity": "anonymized", "case_records": "preserved"}

    set_tenant(db, TenantContext(organization_id=organization_id, user_id=owner.id))
    fuente = db.scalars(select(PaymentSource)).one()
    # Cerrar el despacho cancela la renovación automática: nada se cobra después.
    assert fuente.status == "canceled"
    assert fuente.canceled_at is not None


def test_miembro_cierra_su_cuenta_sin_cerrar_el_despacho(
    dispositivo: NuevoCliente, db: Session
) -> None:
    owner, member, organization = _organization(db, with_member=True)
    assert member is not None
    client = _login(dispositivo, member.email)

    assert _close(client).status_code == 204

    db.refresh(member)
    db.refresh(organization)
    assert member.status == "closed"
    assert organization.status == "active"
    assert db.scalar(select(Membership.id).where(Membership.user_id == member.id)) is None
    assert db.scalar(select(Membership.id).where(Membership.user_id == owner.id)) is not None


def test_propietaria_con_equipo_debe_resolver_la_responsabilidad_primero(
    dispositivo: NuevoCliente, db: Session
) -> None:
    owner, _, organization = _organization(db, with_member=True)
    client = _login(dispositivo, owner.email)

    response = _close(client)

    assert response.status_code == 409
    assert "entregue el despacho a otro miembro" in response.json()["detail"]
    db.refresh(owner)
    db.refresh(organization)
    assert owner.status == "active"
    assert organization.status == "active"


def test_exige_la_contrasena_y_la_frase_exacta(dispositivo: NuevoCliente, db: Session) -> None:
    owner, _, _ = _organization(db)
    client = _login(dispositivo, owner.email)

    wrong = _close(client, "contraseña equivocada")
    missing_phrase = client.post(
        "/api/v1/me/account/closure",
        json={"password": _PASSWORD, "confirmation": "cerrar"},
    )

    assert wrong.status_code == 400
    assert missing_phrase.status_code == 422
    db.refresh(owner)
    assert owner.status == "active"


def test_duena_de_plataforma_no_puede_autocerrar_la_administracion(
    app: FastAPI, dispositivo: NuevoCliente, owner_db: Session
) -> None:
    admin = _user(owner_db, "plataforma@example.com", platform_admin=True)
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: Principal(
        user_id=admin.id,
        session_id=uuid.uuid7(),
        organization_id=None,
        role=None,
        legal_version=LEGAL_VERSION,
    )
    client = dispositivo()

    response = _close(client)

    assert response.status_code == 409
    assert "dueña de la plataforma" in response.json()["detail"]
