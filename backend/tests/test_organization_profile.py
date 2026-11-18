"""Pruebas de cambiar el nombre del despacho (API-022): solo el propietario (RN-010)."""

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Organization, User
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina

_INGRESO = "/api/v1/auth/login"
_ORGANIZACION = "/api/v1/organization"


def _sesion(dispositivo: NuevoCliente, user: User) -> TestClient:
    cliente = dispositivo()
    respuesta = cliente.post(_INGRESO, json={"email": user.email, "password": CLAVE})
    assert respuesta.status_code == 204, respuesta.text
    return cliente


def _renombrar(cliente: TestClient, name: str) -> Any:
    return cliente.patch(_ORGANIZACION, json={"name": name})


def _nombre(db: Session, oficina: Oficina) -> str | None:
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=oficina.owner.id))
    return db.scalar(select(Organization.name).where(Organization.id == oficina.organization_id))


def _auditoria(db: Session, oficina: Oficina) -> list[AuditLog]:
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=oficina.owner.id))
    return list(
        db.scalars(select(AuditLog).where(AuditLog.action == "organization_renamed"))
    )


def test_el_propietario_cambia_el_nombre_y_queda_en_la_auditoria(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    cliente = _sesion(dispositivo, oficina.owner)

    respuesta = _renombrar(cliente, "Restrepo y Asociados")

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["name"] == "Restrepo y Asociados"
    assert _nombre(db, oficina) == "Restrepo y Asociados"
    eventos = _auditoria(db, oficina)
    assert len(eventos) == 1
    assert eventos[0].target_id == oficina.organization_id


def test_repetir_el_mismo_nombre_no_deja_otro_evento(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm", nombre="Restrepo")
    cliente = _sesion(dispositivo, oficina.owner)

    assert _renombrar(cliente, "Restrepo Abogados").status_code == 200

    assert _auditoria(db, oficina) == []


def test_el_administrador_no_cambia_el_nombre(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    admin = crear_miembro(db, oficina, "admin@example.com", "admin")
    cliente = _sesion(dispositivo, admin)

    respuesta = _renombrar(cliente, "Otro nombre")

    assert respuesta.status_code == 403
    assert _nombre(db, oficina) == "Restrepo Abogados"


def test_un_abogado_o_un_asistente_no_cambia_el_nombre(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    for rol in ("lawyer", "assistant"):
        persona = crear_miembro(db, oficina, f"{rol}@example.com", rol)
        cliente = _sesion(dispositivo, persona)

        assert _renombrar(cliente, "Otro nombre").status_code == 403

    assert _nombre(db, oficina) == "Restrepo Abogados"


def test_sin_sesion_no_se_cambia_el_nombre(dispositivo: NuevoCliente) -> None:
    cliente = dispositivo()

    assert cliente.patch(_ORGANIZACION, json={"name": "Otro nombre"}).status_code == 401


def test_el_nombre_vacio_o_muy_largo_se_rechaza(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    cliente = _sesion(dispositivo, oficina.owner)

    assert _renombrar(cliente, "").status_code == 422
    assert _renombrar(cliente, "x" * 121).status_code == 422
    assert _nombre(db, oficina) == "Restrepo Abogados"


def test_el_cuerpo_no_admite_campos_de_mas(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    cliente = _sesion(dispositivo, oficina.owner)

    respuesta = cliente.patch(
        _ORGANIZACION, json={"name": "Otro nombre", "id": "algo"}
    )

    assert respuesta.status_code == 422
