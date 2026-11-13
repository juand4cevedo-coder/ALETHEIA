"""Pruebas de la lista de casos de cada persona (HU-017, API-023)."""

import base64
import datetime
import hashlib
import json
import os
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, get_args

import pytest
from sqlalchemy import Engine, delete, event
from sqlalchemy.orm import Session

from app.api.cases import INVALID_CURSOR
from app.core.legal import LEGAL_VERSION
from app.db.tenancy import TenantContext, set_tenant
from app.models import Case, CaseMember, CustodyEvent, Evidence, Membership, User
from app.models.evidence import DECLARED_TYPES
from app.schemas.cases import DeclaredType
from app.services.cases import InvalidCursorError, initials, list_cases
from app.services.sessions import Principal
from tests.conftest import ZERO_HASH, NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina

_CASOS = "/api/v1/cases"
_INGRESO = "/api/v1/auth/login"
# Una hora fija de referencia: la actividad de cada caso se mide en minutos antes de ella.
_AHORA = datetime.datetime(2026, 11, 10, 15, 0, tzinfo=datetime.UTC)


def _principal(oficina: Oficina, user: User, role: str = "owner") -> Principal:
    return Principal(
        user_id=user.id,
        session_id=uuid.uuid7(),
        organization_id=oficina.organization_id,
        role=role,
        legal_version=LEGAL_VERSION,
    )


def _caso(
    db: Session,
    oficina: Oficina,
    miembros: list[User],
    *,
    hace: int = 0,
    titulo: str = "Despido de María Pérez",
    estado: str = "open",
    acciones: tuple[str, ...] = (),
    evidencias: tuple[tuple[str, str], ...] = (),
) -> uuid.UUID:
    """Un caso con su equipo, su cadena y sus evidencias.

    El último evento ocurre `hace` minutos antes de _AHORA; los anteriores, un minuto antes cada
    uno. `evidencias` son pares (tipo declarado, estado del sello).
    """
    creador = miembros[0]
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=creador.id))
    caso_id = uuid.uuid7()
    db.add(
        Case(
            id=caso_id,
            organization_id=oficina.organization_id,
            title=titulo,
            status=estado,
            closed_at=None if estado == "open" else _AHORA,
            wrapped_key=os.urandom(40),
            key_version="prueba",
            created_by=creador.id,
        )
    )
    db.flush()
    for posicion, miembro in enumerate(miembros):
        db.add(
            CaseMember(
                case_id=caso_id,
                user_id=miembro.id,
                organization_id=oficina.organization_id,
                added_by=creador.id,
                added_at=_AHORA - datetime.timedelta(days=1) + datetime.timedelta(seconds=posicion),
            )
        )
    db.flush()
    cadena = ("case_created", *acciones)
    previo = ZERO_HASH
    for seq, accion in enumerate(cadena, start=1):
        evento = CustodyEvent(
            organization_id=oficina.organization_id,
            case_id=caso_id,
            seq=seq,
            actor_user_id=None if accion == "evidence_stamped" else creador.id,
            action=accion,
            details={},
            occurred_at=_AHORA - datetime.timedelta(minutes=hace + len(cadena) - seq),
            prev_hash=previo,
        )
        db.add(evento)
        db.flush()
        previo = evento.event_hash
    for tipo, sello in evidencias:
        evidencia_id = uuid.uuid7()
        contenido = evidencia_id.bytes
        db.add(
            Evidence(
                id=evidencia_id,
                organization_id=oficina.organization_id,
                case_id=caso_id,
                sha256=hashlib.sha256(contenido).digest(),
                size_bytes=len(contenido),
                original_filename="prueba.txt",
                declared_type=tipo,
                detected_type="text/plain",
                declared_origin="Entregada por el cliente",
                storage_key=f"cases/{caso_id}/{evidencia_id}",
                tsa_status=sello,
                tsa_token=b"sello" if sello == "stamped" else None,
                tsa_time=_AHORA if sello == "stamped" else None,
                uploaded_by=creador.id,
            )
        )
    db.flush()
    set_tenant(db, TenantContext())
    return caso_id


@contextmanager
def _contar_consultas(engine: Engine) -> Iterator[list[str]]:
    consultas: list[str] = []

    def anotar(*args: Any) -> None:
        consultas.append(args[2])

    event.listen(engine, "before_cursor_execute", anotar)
    try:
        yield consultas
    finally:
        event.remove(engine, "before_cursor_execute", anotar)


# --- Servicio -----------------------------------------------------------------------------


def test_solo_aparecen_los_casos_donde_soy_miembro(db: Session) -> None:
    oficina = crear_oficina(db)
    abogada = crear_miembro(db, oficina, "abogada@example.com", "lawyer")
    mio = _caso(db, oficina, [oficina.owner, abogada], titulo="Mío")
    _caso(db, oficina, [abogada], titulo="De la abogada")

    listado = list_cases(
        db, _principal(oficina, oficina.owner), status="all", cursor=None, limit=25
    )

    assert [item.id for item in listado.items] == [mio]
    assert listado.next_cursor is None
    assert listado.totals.open == 1


def test_cada_caso_trae_su_actividad(db: Session) -> None:
    oficina = crear_oficina(db, nombre="Restrepo")
    abogada = crear_miembro(db, oficina, "abogada@example.com", "lawyer")
    asistente = crear_miembro(db, oficina, "asistente@example.com", "assistant")
    otra = crear_miembro(db, oficina, "otra@example.com", "lawyer")
    caso_id = _caso(
        db,
        oficina,
        [oficina.owner, abogada, asistente, otra],
        hace=3,
        acciones=(
            "member_added",
            "evidence_uploaded",
            "evidence_uploaded",
            "evidence_uploaded",
            "evidence_stamped",
            "evidence_downloaded",
        ),
        evidencias=(("chat", "stamped"), ("chat", "pending"), ("email", "pending")),
    )

    (item,) = list_cases(
        db, _principal(oficina, oficina.owner), status="open", cursor=None, limit=25
    ).items

    assert item.id == caso_id
    assert item.created_by_name == oficina.owner.full_name
    assert item.member_count == 4
    assert item.evidence_count == 3
    assert item.evidence_by_type == {"chat": 2, "email": 1}
    # Ana Restrepo, y dos Carlos Gómez: las tres primeras en llegar.
    assert item.member_initials == ["AR", "CG", "CG"]
    assert item.recent_actions == [
        "evidence_uploaded",
        "evidence_uploaded",
        "evidence_uploaded",
        "evidence_stamped",
        "evidence_downloaded",
    ]
    assert item.last_event is not None
    assert item.last_event.action == "evidence_downloaded"
    assert item.last_event.actor_name == oficina.owner.full_name
    assert item.last_event.occurred_at == _AHORA - datetime.timedelta(minutes=3)
    assert item.last_activity_at == item.last_event.occurred_at


def test_el_equipo_cuenta_solo_a_quienes_siguen_en_la_organizacion(db: Session) -> None:
    # Igual que el detalle del caso: quien salió de la organización ya no es parte del equipo.
    oficina = crear_oficina(db, nombre="Restrepo")
    abogada = crear_miembro(db, oficina, "abogada@example.com", "lawyer")
    asistente = crear_miembro(db, oficina, "asistente@example.com", "assistant")
    _caso(db, oficina, [oficina.owner, abogada, asistente])
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=oficina.owner.id))
    db.execute(
        delete(Membership).where(
            Membership.organization_id == oficina.organization_id,
            Membership.user_id == abogada.id,
        )
    )
    db.flush()
    set_tenant(db, TenantContext())

    (item,) = list_cases(
        db, _principal(oficina, oficina.owner), status="open", cursor=None, limit=25
    ).items

    assert item.member_count == 2
    assert item.member_initials == ["AR", "CG"]


def test_ordena_por_ultima_actividad_y_pagina_por_cursor(db: Session) -> None:
    oficina = crear_oficina(db)
    # Dos casos con la misma hora de actividad: los desempata el identificador.
    esperados = [_caso(db, oficina, [oficina.owner], hace=minutos) for minutos in range(29)]
    esperados.append(_caso(db, oficina, [oficina.owner], hace=28))
    principal = _principal(oficina, oficina.owner)

    primera = list_cases(db, principal, status="open", cursor=None, limit=25)
    assert primera.next_cursor is not None
    segunda = list_cases(db, principal, status="open", cursor=primera.next_cursor, limit=25)

    vistos = [item.id for item in primera.items + segunda.items]
    assert len(primera.items) == 25
    assert len(segunda.items) == 5
    assert segunda.next_cursor is None
    assert len(set(vistos)) == 30
    assert vistos[:28] == esperados[:28]
    # Los dos empatados van del identificador mayor al menor.
    assert vistos[28:] == sorted(esperados[28:], reverse=True)
    actividad = [item.last_activity_at for item in primera.items + segunda.items]
    assert actividad == sorted(actividad, reverse=True)


def test_filtra_por_estado(db: Session) -> None:
    oficina = crear_oficina(db)
    abierto = _caso(db, oficina, [oficina.owner], hace=1)
    cerrado = _caso(db, oficina, [oficina.owner], hace=2, estado="closed")
    _caso(db, oficina, [oficina.owner], hace=3, estado="deleting")
    principal = _principal(oficina, oficina.owner)

    def ids(estado: Any) -> list[uuid.UUID]:
        listado = list_cases(db, principal, status=estado, cursor=None, limit=25)
        return [item.id for item in listado.items]

    assert ids("open") == [abierto]
    assert ids("closed") == [cerrado]
    assert ids("all") == [abierto, cerrado]


def test_los_totales_cuentan_por_estado(db: Session) -> None:
    oficina = crear_oficina(db)
    abogada = crear_miembro(db, oficina, "abogada@example.com", "lawyer")
    _caso(
        db,
        oficina,
        [oficina.owner],
        acciones=("evidence_uploaded", "evidence_uploaded"),
        evidencias=(("chat", "pending"), ("audio", "stamped")),
    )
    _caso(db, oficina, [oficina.owner], evidencias=(("image", "pending"),))
    _caso(
        db,
        oficina,
        [oficina.owner],
        estado="closed",
        acciones=("case_closed",),
        evidencias=(("document", "failed"),),
    )
    _caso(db, oficina, [oficina.owner], estado="deleting", evidencias=(("chat", "pending"),))
    # De un caso ajeno no cuenta nada.
    _caso(db, oficina, [abogada], evidencias=(("chat", "pending"),))

    # Los totales no dependen del filtro ni de la página.
    for estado in ("open", "closed", "all"):
        totales = list_cases(
            db, _principal(oficina, oficina.owner), status=estado, cursor=None, limit=1
        ).totals
        assert totales.open == 2
        assert totales.closed == 1
        assert totales.evidences == 4
        assert totales.pending_stamps == 2
        assert totales.custody_events == 6


def test_la_lista_no_hace_una_consulta_por_caso(db: Session, app_engine: Engine) -> None:
    oficina = crear_oficina(db)
    abogada = crear_miembro(db, oficina, "abogada@example.com", "lawyer")
    principal = _principal(oficina, oficina.owner)

    def contar() -> int:
        db.expire_all()
        with _contar_consultas(app_engine) as consultas:
            listado = list_cases(db, principal, status="all", cursor=None, limit=25)
        assert listado.items
        return len(consultas)

    for minutos in range(3):
        _caso(
            db,
            oficina,
            [oficina.owner, abogada],
            hace=minutos,
            acciones=("evidence_uploaded",),
            evidencias=(("chat", "pending"),),
        )
    con_tres = contar()
    for minutos in range(3, 20):
        _caso(
            db,
            oficina,
            [oficina.owner, abogada],
            hace=minutos,
            acciones=("evidence_uploaded",),
            evidencias=(("chat", "pending"),),
        )

    assert contar() == con_tres
    assert con_tres <= 3


@pytest.mark.parametrize(
    "cursor",
    [
        "no-es-base64-%%%",
        base64.urlsafe_b64encode(b"no es json").decode(),
        base64.urlsafe_b64encode(json.dumps({"at": "ayer", "id": "x"}).encode()).decode(),
        base64.urlsafe_b64encode(
            json.dumps({"at": "2026-11-10T15:00:00", "id": str(uuid.uuid7())}).encode()
        ).decode(),
        base64.urlsafe_b64encode(json.dumps([1, 2]).encode()).decode(),
    ],
    ids=["no-base64", "no-json", "campos-invalidos", "hora-sin-zona", "no-objeto"],
)
def test_un_cursor_invalido_lo_rechaza_el_servicio(db: Session, cursor: str) -> None:
    oficina = crear_oficina(db)

    with pytest.raises(InvalidCursorError):
        list_cases(db, _principal(oficina, oficina.owner), status="open", cursor=cursor, limit=25)


def test_los_tipos_de_la_api_son_los_de_la_base() -> None:
    assert get_args(DeclaredType) == DECLARED_TYPES


@pytest.mark.parametrize(
    ("nombre", "iniciales"),
    [("Ana Restrepo", "AR"), ("María José Pérez Gómez", "MG"), ("Ana", "A"), ("  ", "")],
)
def test_las_iniciales_salen_del_primer_nombre_y_la_ultima_palabra(
    nombre: str, iniciales: str
) -> None:
    assert initials(nombre) == iniciales


# --- Ruta ---------------------------------------------------------------------------------


def _sesion(dispositivo: NuevoCliente, user: User) -> Any:
    cliente = dispositivo()
    respuesta = cliente.post(_INGRESO, json={"email": user.email, "password": CLAVE})
    assert respuesta.status_code == 204, respuesta.text
    return cliente


def test_la_ruta_devuelve_la_pagina_con_sus_totales(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db)
    caso_id = _caso(db, oficina, [oficina.owner], evidencias=(("chat", "pending"),))
    cliente = _sesion(dispositivo, oficina.owner)

    respuesta = cliente.get(_CASOS)

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.headers["Cache-Control"] == "no-store"
    cuerpo = respuesta.json()
    assert [item["id"] for item in cuerpo["items"]] == [str(caso_id)]
    item = cuerpo["items"][0]
    assert item["evidence_by_type"] == {"chat": 1}
    assert item["member_initials"] == ["AR"]
    assert item["recent_actions"] == ["case_created"]
    assert item["last_event"]["action"] == "case_created"
    assert cuerpo["next_cursor"] is None
    assert cuerpo["totals"] == {
        "open": 1,
        "closed": 0,
        "evidences": 1,
        "pending_stamps": 1,
        "custody_events": 1,
    }


def test_otra_organizacion_no_ve_mis_casos(dispositivo: NuevoCliente, db: Session) -> None:
    mia = crear_oficina(db, nombre="Restrepo")
    otra = crear_oficina(db, nombre="Gómez")
    _caso(db, mia, [mia.owner])
    _caso(db, mia, [mia.owner], estado="closed")

    respuesta = _sesion(dispositivo, otra.owner).get(_CASOS, params={"status": "all"})

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["items"] == []
    assert cuerpo["totals"] == {
        "open": 0,
        "closed": 0,
        "evidences": 0,
        "pending_stamps": 0,
        "custody_events": 0,
    }


def test_un_cursor_alterado_responde_422(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db)
    for minutos in range(3):
        _caso(db, oficina, [oficina.owner], hace=minutos)
    cliente = _sesion(dispositivo, oficina.owner)
    cursor = cliente.get(_CASOS, params={"limit": 1}).json()["next_cursor"]
    assert cursor is not None
    alterado = base64.urlsafe_b64encode(
        base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).replace(b'"', b"'", 1)
    ).decode()

    respuesta = cliente.get(_CASOS, params={"cursor": alterado})

    assert respuesta.status_code == 422, respuesta.text
    assert respuesta.json()["detail"] == INVALID_CURSOR
    assert respuesta.headers["Cache-Control"] == "no-store"


@pytest.mark.parametrize("limite", [0, 51])
def test_el_limite_va_de_1_a_50(dispositivo: NuevoCliente, db: Session, limite: int) -> None:
    oficina = crear_oficina(db)

    respuesta = _sesion(dispositivo, oficina.owner).get(_CASOS, params={"limit": limite})

    assert respuesta.status_code == 422


def test_sin_sesion_responde_401(dispositivo: NuevoCliente) -> None:
    assert dispositivo().get(_CASOS).status_code == 401
