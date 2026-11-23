"""Las medidas de rendimiento reales no identifican a nadie y se resumen con el percentil 75."""

import datetime
import uuid

import pytest
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.core.legal import LEGAL_VERSION
from app.models import User, WebVital
from app.services import web_vitals as vitals_service
from app.services.sessions import Principal
from tests.conftest import NuevoCliente

_RUTA = "/api/v1/web-vitals"


def _visita(**cambios: object) -> dict[str, object]:
    cuerpo: dict[str, object] = {
        "page": "inicio",
        "device": "movil",
        "connection": "4g",
        "metrics": [
            {"name": "LCP", "value": 2100.5},
            {"name": "CLS", "value": 0.02},
            {"name": "TTFB", "value": 310},
        ],
    }
    cuerpo.update(cambios)
    return cuerpo


def _cantidad(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(WebVital)) or 0


def test_una_visita_entrega_sus_medidas_sin_sesion(
    app: FastAPI, dispositivo: NuevoCliente, db: Session
) -> None:
    respuesta = dispositivo().post(_RUTA, json=_visita())

    assert respuesta.status_code == 204, respuesta.text
    assert respuesta.headers["Cache-Control"] == "no-store"
    filas = db.scalars(select(WebVital).order_by(WebVital.metric)).all()
    assert [(fila.metric, fila.value) for fila in filas] == [
        ("CLS", 0.02),
        ("LCP", 2100.5),
        ("TTFB", 310),
    ]
    assert {(fila.page, fila.device, fila.connection) for fila in filas} == {
        ("inicio", "movil", "4g")
    }
    assert {fila.version for fila in filas} == {app.version}


def test_la_tabla_no_guarda_nada_que_identifique_a_la_persona() -> None:
    assert set(WebVital.__table__.columns.keys()) == {
        "id",
        "created_at",
        "metric",
        "value",
        "page",
        "device",
        "connection",
        "version",
    }


@pytest.mark.parametrize(
    "cuerpo",
    [
        _visita(page="/app/casos/123"),
        _visita(device="tablet"),
        _visita(connection="5g"),
        _visita(metrics=[]),
        _visita(metrics=[{"name": "FID", "value": 10}]),
        _visita(metrics=[{"name": "LCP", "value": -1}]),
        _visita(metrics=[{"name": "LCP", "value": 700_000}]),
        _visita(metrics=[{"name": "LCP", "value": 10}] * 6),
        _visita(url="https://aletheia.sbs/app/casos/123"),
        _visita(user_id=str(uuid.uuid4())),
    ],
)
def test_rechaza_lo_que_no_sea_una_medida_de_la_lista(
    cuerpo: dict[str, object], dispositivo: NuevoCliente, db: Session
) -> None:
    respuesta = dispositivo().post(_RUTA, json=cuerpo)

    assert respuesta.status_code == 422
    assert _cantidad(db) == 0


def test_una_metrica_repetida_cuenta_una_sola_vez(dispositivo: NuevoCliente, db: Session) -> None:
    cuerpo = _visita(metrics=[{"name": "LCP", "value": 1000}, {"name": "LCP", "value": 9000}])

    assert dispositivo().post(_RUTA, json=cuerpo).status_code == 204
    assert db.scalars(select(WebVital.value)).all() == [1000]


def test_limita_las_entregas_por_ip(dispositivo: NuevoCliente, db: Session) -> None:
    cliente = dispositivo()
    for _ in range(60):
        assert cliente.post(_RUTA, json=_visita()).status_code == 204

    excedido = cliente.post(_RUTA, json=_visita())

    assert excedido.status_code == 429
    assert int(excedido.headers["Retry-After"]) > 0


def _usuario(session: Session, correo: str, *, plataforma: bool) -> User:
    usuario = User(
        email=correo,
        full_name="Cuenta de prueba",
        email_verified_at=datetime.datetime.now(datetime.UTC),
        is_platform_admin=plataforma,
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
    )
    session.add(usuario)
    session.flush()
    return usuario


def _principal(usuario: User) -> Principal:
    return Principal(
        user_id=usuario.id,
        session_id=uuid.uuid7(),
        organization_id=None,
        role=None,
        legal_version=LEGAL_VERSION,
    )


def _medida(metrica: str, valor: float, **cambios: object) -> WebVital:
    datos: dict[str, object] = {
        "metric": metrica,
        "value": valor,
        "page": "inicio",
        "device": "movil",
        "connection": None,
        "version": "0.19.3",
    }
    datos.update(cambios)
    return WebVital(**datos)


def test_el_resumen_calcula_el_percentil_75_y_lo_valora(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _usuario(owner_db, "admin@example.com", plataforma=True)
    owner_db.add_all(
        [_medida("LCP", valor) for valor in (1000, 2000, 3000, 4000)]
        + [_medida("CLS", 0.05), _medida("CLS", 0.06)]
        + [_medida("LCP", 9000, device="escritorio", version="0.19.2")]
    )
    owner_db.flush()
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(admin)

    respuesta = dispositivo().get("/api/v1/platform/web-vitals?days=7")

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["days"] == 7
    assert cuerpo["total_samples"] == 7
    por_clave = {(f["version"], f["device"], f["metric"]): f for f in cuerpo["rows"]}
    lcp = por_clave[("0.19.3", "movil", "LCP")]
    assert lcp["samples"] == 4
    assert lcp["p75"] == pytest.approx(3250)
    assert lcp["good_share"] == pytest.approx(0.5)
    assert lcp["rating"] == "needs-improvement"
    cls = por_clave[("0.19.3", "movil", "CLS")]
    assert cls["rating"] == "good"
    assert cls["good_share"] == pytest.approx(1.0)
    assert por_clave[("0.19.2", "escritorio", "LCP")]["rating"] == "poor"


def test_el_resumen_es_solo_para_la_plataforma(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    comun = _usuario(owner_db, "comun@example.com", plataforma=False)
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(comun)
    cliente = dispositivo()

    assert cliente.get("/api/v1/platform/web-vitals").status_code == 403


def test_el_resumen_no_acepta_ventanas_de_mas_de_90_dias(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _usuario(owner_db, "admin2@example.com", plataforma=True)
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(admin)

    assert dispositivo().get("/api/v1/platform/web-vitals?days=91").status_code == 422


def test_el_trabajador_borra_las_medidas_con_mas_de_90_dias(owner_db: Session) -> None:
    ahora = datetime.datetime.now(datetime.UTC)
    owner_db.add_all(
        [
            _medida("LCP", 1000, created_at=ahora - datetime.timedelta(days=91)),
            _medida("LCP", 2000, created_at=ahora - datetime.timedelta(days=89)),
        ]
    )
    owner_db.flush()

    borradas = vitals_service.purge_expired(owner_db)

    assert borradas == 1
    assert owner_db.scalars(select(WebVital.value)).all() == [2000]
