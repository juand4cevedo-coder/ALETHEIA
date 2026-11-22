"""Acceso OIDC de Google: PKCE, vinculación explícita y sesiones normales de Aletheia."""

import datetime
import urllib.parse
import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.google_oidc import GoogleIdentity, pkce_challenge
from app.api.deps import get_google_oidc
from app.core.legal import LEGAL_VERSION
from app.core.passwords import hash_password
from app.db.tenancy import TenantContext, set_tenant
from app.models import (
    AuditLog,
    LegalAcceptance,
    Membership,
    OAuthIdentity,
    Organization,
    Subscription,
    User,
)
from tests.conftest import NuevoCliente


class FakeGoogle:
    def __init__(self, subject: str = "google-subject-123", email: str = "ana@example.com") -> None:
        self.subject = subject
        self.email = email
        self.exchanges: list[tuple[str, str, str]] = []

    def authorization_url(self, *, state: str, nonce: str, code_challenge: str) -> str:
        return "https://accounts.google.test/auth?" + urllib.parse.urlencode(
            {"state": state, "nonce": nonce, "code_challenge": code_challenge}
        )

    def exchange(self, *, code: str, code_verifier: str, nonce: str) -> GoogleIdentity:
        self.exchanges.append((code, code_verifier, nonce))
        return GoogleIdentity(
            subject=self.subject,
            email=self.email,
            email_verified=True,
            full_name="Ana Restrepo",
        )


def _account(db: Session) -> tuple[User, uuid.UUID]:
    user = User(
        email="ana@example.com",
        password_hash=hash_password("una frase larga y fácil"),
        full_name="Ana Restrepo",
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
    )
    db.add(user)
    db.flush()
    organization_id = uuid.uuid7()
    set_tenant(db, TenantContext(organization_id=organization_id, user_id=user.id))
    db.add(Organization(id=organization_id, name="Restrepo Abogados"))
    db.flush()
    db.add(Membership(organization_id=organization_id, user_id=user.id, role="owner"))
    db.commit()
    set_tenant(db, TenantContext())
    return user, organization_id


def _state(response_location: str) -> str:
    query = urllib.parse.parse_qs(urllib.parse.urlparse(response_location).query)
    return query["state"][0]


def _start(client: TestClient, path: str) -> str:
    response = client.get(path, follow_redirects=False)
    assert response.status_code == 303, response.text
    assert response.headers["location"].startswith("https://accounts.google.test/auth?")
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "secure" in cookie
    assert "samesite=lax" in cookie
    assert "path=/api/v1/auth/google" in cookie
    assert response.headers["referrer-policy"] == "no-referrer"
    return _state(response.headers["location"])


def _start_registration(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/google/register",
        data={
            "account_type": "firm",
            "organization_name": "Restrepo Abogados",
            "legal_version": LEGAL_VERSION,
            "accepts_legal_terms": "true",
        },
        headers={
            "Origin": "http://localhost:5173",
            "Sec-Fetch-Site": "same-origin",
            "X-Aletheia-Request": "",
        },
        follow_redirects=False,
    )
    assert response.status_code == 303, response.text
    assert response.headers["location"].startswith("https://accounts.google.test/auth?")
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "secure" in cookie
    assert "samesite=lax" in cookie
    return _state(response.headers["location"])


def test_pkce_usa_s256_sin_relleno_base64() -> None:
    # Vector de ejemplo de RFC 7636, apéndice B.
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    assert pkce_challenge(verifier) == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"


def test_vincula_google_solo_desde_una_sesion_y_deja_auditoria(
    app: FastAPI, dispositivo: NuevoCliente, db: Session
) -> None:
    user, organization_id = _account(db)
    google = FakeGoogle()
    app.dependency_overrides[get_google_oidc] = lambda: google
    client = dispositivo()
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": "una frase larga y fácil"},
        ).status_code
        == 204
    )

    state = _start(client, "/api/v1/auth/google/link")
    callback = client.get(
        "/api/v1/auth/google/callback",
        params={"state": state, "code": "codigo-de-google"},
        follow_redirects=False,
    )

    assert callback.status_code == 303
    assert callback.headers["location"] == "/app/cuenta?google=vinculado"
    identity = db.scalar(select(OAuthIdentity).where(OAuthIdentity.user_id == user.id))
    assert identity is not None
    assert (identity.provider, identity.subject) == ("google", google.subject)
    set_tenant(db, TenantContext(organization_id=organization_id, user_id=user.id))
    audit = db.scalar(select(AuditLog).where(AuditLog.action == "google_linked"))
    assert audit is not None
    assert audit.actor_user_id == user.id


def test_una_identidad_vinculada_puede_ingresar(
    app: FastAPI, dispositivo: NuevoCliente, db: Session
) -> None:
    user, _ = _account(db)
    google = FakeGoogle()
    db.add(OAuthIdentity(user_id=user.id, provider="google", subject=google.subject))
    db.commit()
    app.dependency_overrides[get_google_oidc] = lambda: google
    client = dispositivo()

    state = _start(client, "/api/v1/auth/google/login")
    callback = client.get(
        "/api/v1/auth/google/callback",
        params={"state": state, "code": "codigo-de-google"},
        follow_redirects=False,
    )

    assert callback.status_code == 303
    assert callback.headers["location"] == "/app"
    profile = client.get("/api/v1/me")
    assert profile.status_code == 200
    assert profile.json()["google_linked"] is True


def test_google_crea_cuenta_sin_contrasena_y_abre_sesion(
    app: FastAPI, dispositivo: NuevoCliente, db: Session
) -> None:
    google = FakeGoogle(email="nueva@example.com")
    app.dependency_overrides[get_google_oidc] = lambda: google
    client = dispositivo()

    state = _start_registration(client)
    callback = client.get(
        "/api/v1/auth/google/callback",
        params={"state": state, "code": "codigo-de-google"},
        follow_redirects=False,
    )

    assert callback.status_code == 303
    assert callback.headers["location"] == "/app"
    profile = client.get("/api/v1/me")
    assert profile.status_code == 200
    assert profile.json()["google_linked"] is True
    assert profile.json()["organization"]["name"] == "Restrepo Abogados"

    user = db.scalar(select(User).where(User.email == "nueva@example.com"))
    assert user is not None
    assert user.password_hash is None
    assert user.email_verified_at is not None
    assert user.full_name == "Ana Restrepo"
    assert db.scalar(select(OAuthIdentity).where(OAuthIdentity.user_id == user.id)) is not None
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    assert membership is not None
    subscription = db.scalar(
        select(Subscription).where(Subscription.organization_id == membership.organization_id)
    )
    assert subscription is not None
    assert subscription.status == "trial"
    acceptance = db.scalar(select(LegalAcceptance).where(LegalAcceptance.user_id == user.id))
    assert acceptance is not None
    assert acceptance.version == LEGAL_VERSION


def test_registro_google_no_enlaza_una_cuenta_existente_por_correo(
    app: FastAPI, dispositivo: NuevoCliente, db: Session
) -> None:
    user, _ = _account(db)
    google = FakeGoogle(subject="otra-identidad-google", email=user.email)
    app.dependency_overrides[get_google_oidc] = lambda: google
    client = dispositivo()

    state = _start_registration(client)
    callback = client.get(
        "/api/v1/auth/google/callback",
        params={"state": state, "code": "codigo-de-google"},
        follow_redirects=False,
    )

    assert callback.headers["location"] == "/registro?google=correo-en-uso"
    assert client.get("/api/v1/me").status_code == 401
    assert db.scalar(select(OAuthIdentity).where(OAuthIdentity.user_id == user.id)) is None


def test_no_asocia_por_correo_si_la_identidad_no_esta_vinculada(
    app: FastAPI, dispositivo: NuevoCliente, db: Session
) -> None:
    _account(db)
    google = FakeGoogle()
    app.dependency_overrides[get_google_oidc] = lambda: google
    client = dispositivo()

    state = _start(client, "/api/v1/auth/google/login")
    callback = client.get(
        "/api/v1/auth/google/callback",
        params={"state": state, "code": "codigo-de-google"},
        follow_redirects=False,
    )

    assert callback.headers["location"] == "/ingresar?google=sin-vinculo"
    assert client.get("/api/v1/me").status_code == 401


def test_rechaza_state_alterado_antes_de_intercambiar_el_codigo(
    app: FastAPI, dispositivo: NuevoCliente
) -> None:
    google = FakeGoogle()
    app.dependency_overrides[get_google_oidc] = lambda: google
    client = dispositivo()
    _start(client, "/api/v1/auth/google/login")

    callback = client.get(
        "/api/v1/auth/google/callback",
        params={"state": "estado-alterado", "code": "codigo-de-google"},
        follow_redirects=False,
    )

    assert callback.headers["location"] == "/ingresar?google=error"
    assert google.exchanges == []
