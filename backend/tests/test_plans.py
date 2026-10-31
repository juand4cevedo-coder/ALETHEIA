"""Pruebas del catálogo público de planes (API-002, HU-002)."""

from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings
from app.core.errors import PROBLEM_JSON
from app.main import create_app
from app.models import Plan
from app.services.plans import TRIAL_DAYS

_PATH = "/api/v1/plans"
# Puerto 1 en la propia máquina: nada escucha ahí, así que la conexión se rechaza.
_UNREACHABLE_DATABASE = "postgresql+psycopg://aletheia:sin-uso@127.0.0.1:1/aletheia"


@pytest.fixture
def client(settings: Settings, db: Session) -> Iterator[TestClient]:
    """Cliente cuya API lee con la sesión de la prueba: ve sus cambios y luego se deshacen."""
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: db
    with TestClient(app) as test_client:
        yield test_client


def test_entrega_los_planes_publicos_con_los_valores_del_catalogo(
    client: TestClient, db: Session
) -> None:
    response = client.get(_PATH)

    assert response.status_code == 200
    publicos = db.scalars(select(Plan).where(Plan.is_public)).all()
    esperados = {
        plan.code: {
            "name": plan.name,
            "monthly_price_cop": plan.monthly_price_cop,
            "annual_price_cop": plan.annual_price_cop,
            "included_users": plan.included_users,
            "extra_user_price_cop": plan.extra_user_price_cop,
            "storage_limit_bytes": plan.storage_limit_bytes,
            "max_file_bytes": plan.max_file_bytes,
        }
        for plan in publicos
    }
    recibidos = {
        plan["code"]: {campo: plan[campo] for campo in esperados[plan["code"]]}
        for plan in response.json()
    }
    assert recibidos == esperados


def test_corporativo_se_cotiza_y_no_figura(client: TestClient) -> None:
    codigos = [plan["code"] for plan in client.get(_PATH).json()]

    assert "corporate" not in codigos


def test_los_planes_van_del_mas_economico_al_mas_amplio(client: TestClient) -> None:
    precios = [plan["monthly_price_cop"] for plan in client.get(_PATH).json()]

    assert precios == sorted(precios)


def test_el_pago_anual_cuesta_diez_meses(client: TestClient) -> None:
    for plan in client.get(_PATH).json():
        if plan["annual_price_cop"] is not None:
            assert plan["annual_price_cop"] == 10 * plan["monthly_price_cop"], plan["code"]


def test_solo_la_prueba_tiene_dias_de_duracion(client: TestClient) -> None:
    dias = {plan["code"]: plan["trial_days"] for plan in client.get(_PATH).json()}

    assert dias.pop("trial") == TRIAL_DAYS
    assert set(dias.values()) == {None}


def test_un_cambio_en_el_catalogo_se_ve_sin_tocar_el_codigo(
    client: TestClient, db: Session
) -> None:
    db.execute(update(Plan).where(Plan.code == "essential").values(monthly_price_cop=31_900))

    esencial = next(plan for plan in client.get(_PATH).json() if plan["code"] == "essential")

    assert esencial["monthly_price_cop"] == 31_900


def test_la_respuesta_se_guarda_en_cache_un_minuto(client: TestClient) -> None:
    assert client.get(_PATH).headers["cache-control"] == "public, max-age=60"


def test_sin_base_responde_503_en_problem_details(
    make_settings: Callable[[str], Settings],
) -> None:
    with TestClient(create_app(make_settings(_UNREACHABLE_DATABASE))) as client:
        response = client.get(_PATH)

    assert response.status_code == 503
    assert response.headers["content-type"] == PROBLEM_JSON
    assert response.headers["retry-after"] == "30"
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["detail"] == "El servicio no está disponible en este momento."
    assert "sin-uso" not in response.text
