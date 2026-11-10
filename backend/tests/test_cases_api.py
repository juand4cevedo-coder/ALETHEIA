"""Pruebas de las rutas para abrir un caso y ver su detalle (HU-015, API-022 y API-024)."""

import datetime
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.adapters.keys import KeyWrapperError, LocalKeyWrapper, WrappedKey
from app.api.cases import (
    EMAIL_NOT_VERIFIED,
    FILING_NUMBER_TAKEN,
    KEYS_UNAVAILABLE,
)
from app.api.deps import NOT_ALLOWED, get_key_wrapper
from app.api.organization import NOT_FOUND
from app.db.tenancy import TenantContext, set_tenant
from app.models import Case, Organization, User
from app.schemas.cases import INVALID_FILING_NUMBER
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina

_CASOS = "/api/v1/cases"
_INGRESO = "/api/v1/auth/login"
_RADICADO = "11001310500320260014300"


class _KmsCaido:
    def wrap(self, plaintext: bytes) -> WrappedKey:
        msg = "KMS no respondió"
        raise KeyWrapperError(msg)

    def unwrap(self, wrapped: WrappedKey) -> bytes:
        msg = "KMS no respondió"
        raise KeyWrapperError(msg)


@pytest.fixture(autouse=True)
def _llave_local(app: FastAPI, local_key_path: Path) -> Iterator[None]:
    llave = LocalKeyWrapper.from_pem_file(local_key_path)
    app.dependency_overrides[get_key_wrapper] = lambda: llave
    yield
    app.dependency_overrides.pop(get_key_wrapper, None)


def _verificar(db: Session, user: User) -> None:
    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(email_verified_at=datetime.datetime.now(datetime.UTC))
    )
    db.flush()


def _sesion(
    dispositivo: NuevoCliente, db: Session, user: User, *, verificado: bool = True
) -> TestClient:
    if verificado:
        _verificar(db, user)
    cliente = dispositivo()
    respuesta = cliente.post(_INGRESO, json={"email": user.email, "password": CLAVE})
    assert respuesta.status_code == 204, respuesta.text
    return cliente


def _datos(**cambios: Any) -> dict[str, Any]:
    return {"title": "Despido de María Pérez"} | cambios


def _como_dueno(dispositivo: NuevoCliente, db: Session) -> tuple[Oficina, TestClient]:
    oficina = crear_oficina(db)
    return oficina, _sesion(dispositivo, db, oficina.owner)


def _contar_casos(db: Session, oficina: Oficina) -> int:
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=oficina.owner.id))
    return db.scalar(select(func.count()).select_from(Case)) or 0


def test_un_abogado_abre_un_caso(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db)
    abogado = crear_miembro(db, oficina, "abogada@example.com", "lawyer")
    cliente = _sesion(dispositivo, db, abogado)

    respuesta = cliente.post(
        _CASOS,
        json=_datos(
            title="  Despido de María Pérez  ",
            filing_number=_RADICADO,
            court="Juzgado 3 Laboral de Bogotá",
            practice_area="labor",
            internal_reference="EXP-2026-14",
        ),
    )

    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    assert respuesta.headers["Location"] == f"/api/v1/cases/{cuerpo['id']}"
    assert cuerpo == {
        "id": cuerpo["id"],
        "title": "Despido de María Pérez",
        "filing_number": _RADICADO,
        "court": "Juzgado 3 Laboral de Bogotá",
        "practice_area": "labor",
        "internal_reference": "EXP-2026-14",
        "status": "open",
        "created_at": cuerpo["created_at"],
        "created_by_name": abogado.full_name,
        "member_count": 1,
    }
    uuid.UUID(cuerpo["id"])


@pytest.mark.parametrize(
    "pegado", ["11001-31-05-003-2026-00143-00", "11001 31 05 003 2026 00143 00"]
)
def test_el_radicado_con_separadores_se_normaliza(
    dispositivo: NuevoCliente, db: Session, pegado: str
) -> None:
    _, cliente = _como_dueno(dispositivo, db)

    respuesta = cliente.post(_CASOS, json=_datos(filing_number=pegado))

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["filing_number"] == _RADICADO


@pytest.mark.parametrize("radicado", ["1100131050032026001430A", "1" * 22, "1" * 24])
def test_un_radicado_invalido_responde_422_con_su_mensaje(
    dispositivo: NuevoCliente, db: Session, radicado: str
) -> None:
    _, cliente = _como_dueno(dispositivo, db)

    respuesta = cliente.post(_CASOS, json=_datos(filing_number=radicado))

    assert respuesta.status_code == 422
    assert INVALID_FILING_NUMBER in respuesta.text


@pytest.mark.parametrize("titulo", ["", "    ", "x" * 161])
def test_un_titulo_en_blanco_responde_422(
    dispositivo: NuevoCliente, db: Session, titulo: str
) -> None:
    oficina, cliente = _como_dueno(dispositivo, db)

    respuesta = cliente.post(_CASOS, json={"title": titulo})

    assert respuesta.status_code == 422
    assert _contar_casos(db, oficina) == 0


def test_campos_extra_responden_422(dispositivo: NuevoCliente, db: Session) -> None:
    _, cliente = _como_dueno(dispositivo, db)

    respuesta = cliente.post(_CASOS, json=_datos(status="closed"))

    assert respuesta.status_code == 422


def test_el_asistente_recibe_403(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db)
    asistente = crear_miembro(db, oficina, "asistente@example.com", "assistant")

    respuesta = _sesion(dispositivo, db, asistente).post(_CASOS, json=_datos())

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == NOT_ALLOWED


def test_correo_sin_verificar_recibe_403(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db)
    cliente = _sesion(dispositivo, db, oficina.owner, verificado=False)

    respuesta = cliente.post(_CASOS, json=_datos())

    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == EMAIL_NOT_VERIFIED


def test_solo_lectura_recibe_409(dispositivo: NuevoCliente, db: Session) -> None:
    oficina, cliente = _como_dueno(dispositivo, db)
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=oficina.owner.id))
    db.execute(
        update(Organization)
        .where(Organization.id == oficina.organization_id)
        .values(status="read_only")
    )
    db.flush()

    respuesta = cliente.post(_CASOS, json=_datos())

    assert respuesta.status_code == 409
    assert "solo lectura" in respuesta.json()["detail"]


def test_radicado_repetido_recibe_409(dispositivo: NuevoCliente, db: Session) -> None:
    oficina, cliente = _como_dueno(dispositivo, db)
    assert cliente.post(_CASOS, json=_datos(filing_number=_RADICADO)).status_code == 201

    respuesta = cliente.post(_CASOS, json=_datos(title="Otro", filing_number=_RADICADO))

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"] == FILING_NUMBER_TAKEN
    assert _contar_casos(db, oficina) == 1


def test_kms_caido_responde_503(app: FastAPI, dispositivo: NuevoCliente, db: Session) -> None:
    oficina, cliente = _como_dueno(dispositivo, db)
    app.dependency_overrides[get_key_wrapper] = _KmsCaido

    respuesta = cliente.post(_CASOS, json=_datos())

    assert respuesta.status_code == 503
    assert respuesta.json()["detail"] == KEYS_UNAVAILABLE
    assert _contar_casos(db, oficina) == 0


def test_sin_cabecera_propia_responde_403(dispositivo: NuevoCliente, db: Session) -> None:
    _, cliente = _como_dueno(dispositivo, db)
    cliente.headers.clear()

    respuesta = cliente.post(_CASOS, json=_datos())

    assert respuesta.status_code == 403


def test_el_detalle_de_un_caso_propio_trae_equipo_y_cadena(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina, cliente = _como_dueno(dispositivo, db)
    creado = cliente.post(_CASOS, json=_datos(filing_number=_RADICADO)).json()

    respuesta = cliente.get(f"{_CASOS}/{creado['id']}")

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert {k: cuerpo[k] for k in creado} == creado
    assert [m["user_id"] for m in cuerpo["members"]] == [str(oficina.owner.id)]
    assert cuerpo["members"][0]["role"] == "owner"
    [evento] = cuerpo["recent_events"]
    assert evento["seq"] == 1
    assert evento["action"] == "case_created"
    assert len(evento["event_hash"]) == 64
    int(evento["event_hash"], 16)


def test_el_detalle_de_un_caso_ajeno_responde_404_con_msg_011(
    dispositivo: NuevoCliente, db: Session
) -> None:
    _, cliente = _como_dueno(dispositivo, db)
    creado = cliente.post(_CASOS, json=_datos()).json()
    otra = crear_oficina(db, nombre="Otra")
    ajeno = _sesion(dispositivo, db, otra.owner)

    for destino in (creado["id"], str(uuid.uuid7())):
        respuesta = ajeno.get(f"{_CASOS}/{destino}")
        assert respuesta.status_code == 404
        assert respuesta.json()["detail"] == NOT_FOUND


def test_las_respuestas_no_se_guardan(dispositivo: NuevoCliente, db: Session) -> None:
    _, cliente = _como_dueno(dispositivo, db)

    creacion = cliente.post(_CASOS, json=_datos())
    detalle = cliente.get(f"{_CASOS}/{creacion.json()['id']}")
    ajeno = cliente.get(f"{_CASOS}/{uuid.uuid7()}")

    for respuesta in (creacion, detalle, ajeno):
        assert respuesta.headers["Cache-Control"] == "no-store"
