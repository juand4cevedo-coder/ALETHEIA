"""Solicitudes de cotización del plan Corporativo desde el formulario público de /empresa."""

import datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.main import create_app
from app.models import AuditLog, SupportTicket
from app.schemas.sales import SalesInquiryCreate
from app.services import sales_inquiries, support
from tests.conftest import SAME_ORIGIN_HEADERS, NuevoCliente
from tests.test_captcha import _solve
from tests.test_platform_modules import _principal, _user

_RUTA = "/api/v1/sales-inquiries"


def _cuerpo(**cambios: Any) -> dict[str, Any]:
    return {
        "name": "Laura Restrepo",
        "organization": "Restrepo & Asociados",
        "email": "Laura@Restrepo.example.com",
        "users": 40,
        "message": "Somos tres sedes y queremos el portal del cliente.",
        **cambios,
    }


def test_la_solicitud_queda_en_la_bandeja_como_comercial(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    app.dependency_overrides[get_session] = lambda: owner_db
    cliente = dispositivo()

    respuesta = cliente.post(_RUTA, json=_cuerpo())

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.headers["cache-control"] == "no-store"
    radicado = respuesta.json()["filing_number"]
    assert radicado.startswith("PQR-")
    ticket = owner_db.scalars(
        select(SupportTicket).where(SupportTicket.filing_number == radicado)
    ).one()
    assert ticket.category == "sales"
    assert ticket.user_id is None
    assert ticket.contact_name == "Laura Restrepo"
    assert ticket.contact_email == "laura@restrepo.example.com"
    assert ticket.subject == "Cotización del plan Corporativo: Restrepo & Asociados"
    assert "Usuarios aproximados: 40 usuarios" in ticket.message
    assert "portal del cliente" in ticket.message
    assert owner_db.scalars(
        select(AuditLog.action).where(AuditLog.target_id == ticket.id)
    ).all() == ["support_ticket_opened"]

    admin = _user(owner_db, "duena@example.com", platform_admin=True)
    app.dependency_overrides[get_principal] = lambda: _principal(admin)
    bandeja = cliente.get("/api/v1/platform/support/tickets").json()["items"]
    fila = next(item for item in bandeja if item["filing_number"] == radicado)
    assert fila["category"] == "sales"
    assert fila["user_email"] == "laura@restrepo.example.com"
    assert fila["contact_name"] == "Laura Restrepo"


def test_el_mensaje_es_opcional(app: FastAPI, owner_db: Session, dispositivo: NuevoCliente) -> None:
    app.dependency_overrides[get_session] = lambda: owner_db

    respuesta = dispositivo().post(_RUTA, json=_cuerpo(message="   ", users=1))

    assert respuesta.status_code == 201
    ticket = owner_db.scalars(
        select(SupportTicket).where(
            SupportTicket.filing_number == respuesta.json()["filing_number"]
        )
    ).one()
    assert ticket.message.endswith("Contacto: Laura Restrepo <laura@restrepo.example.com>")
    assert "1 usuario\n" in ticket.message


@pytest.mark.parametrize(
    "cambios",
    [
        {"name": "L"},
        {"organization": ""},
        {"email": "sin-arroba"},
        {"users": 0},
        {"message": "x" * 2001},
        {"extra": "no"},
    ],
)
def test_los_datos_incompletos_se_rechazan(cambios: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        SalesInquiryCreate.model_validate(_cuerpo(**cambios))


def test_sin_cuenta_se_puede_crear_pero_no_leer(db: Session) -> None:
    inquiry = SalesInquiryCreate.model_validate(_cuerpo())
    set_tenant(db, TenantContext())

    radicado = sales_inquiries.open_inquiry(db, inquiry, "203.0.113.9")
    db.flush()

    assert radicado.startswith("PQR-")
    assert db.scalars(select(SupportTicket)).all() == []


def test_el_limite_de_intentos_frena_los_envios_en_masa(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    app.dependency_overrides[get_session] = lambda: owner_db
    cliente = dispositivo()

    estados = [
        cliente.post(_RUTA, json=_cuerpo(email=f"p{numero}@example.com")).status_code
        for numero in range(6)
    ]

    assert estados[:5] == [201] * 5
    assert estados[5] == 429


def test_el_mismo_correo_tiene_su_propio_tope(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    app.dependency_overrides[get_session] = lambda: owner_db
    cliente = dispositivo()

    estados = [cliente.post(_RUTA, json=_cuerpo()).status_code for _ in range(4)]

    assert estados == [201, 201, 201, 429]


def test_exige_la_verificacion_de_persona(settings: Settings, owner_db: Session) -> None:
    application = create_app(settings.model_copy(update={"captcha_required": True}))
    application.dependency_overrides[get_session] = lambda: owner_db
    with TestClient(
        application, base_url="https://testserver", headers=SAME_ORIGIN_HEADERS
    ) as cliente:
        sin = cliente.post(_RUTA, json=_cuerpo())
        assert sin.status_code == 400
        assert "persona" in sin.json()["detail"]

        solucion = _solve(cliente.get("/api/v1/auth/captcha").json())
        con = cliente.post(_RUTA, json=_cuerpo(), headers={"X-Aletheia-Captcha": solucion})
        assert con.status_code == 201


def test_una_cotizacion_resuelta_se_puede_eliminar_enseguida() -> None:
    cerrada = datetime.datetime(2026, 11, 25, 15, 0, tzinfo=datetime.UTC)

    assert support.deletable_on("sales", "closed", cerrada) == datetime.date(2026, 11, 25)
    assert support.due_on("sales", cerrada) > cerrada.date()


def test_una_cuenta_no_pide_cotizaciones_por_el_formulario_de_soporte() -> None:
    from app.schemas.support import SupportTicketCreate

    with pytest.raises(ValidationError):
        SupportTicketCreate.model_validate(
            {"category": "sales", "subject": "Cotización", "message": "Quiero una cotización."}
        )
