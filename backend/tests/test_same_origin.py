"""Pruebas de la protección contra CSRF y de CORS (sección 9 de la especificación)."""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import PROBLEM_JSON
from app.core.middleware import SAME_ORIGIN_HEADER, SameOriginMiddleware
from app.main import create_app

_SITIO = "http://localhost:5173"
_OTRO_SITIO = "https://otro-sitio.example"


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    app: FastAPI = create_app(settings)

    @app.post("/api/v1/prueba/cambio")
    def cambio() -> dict[str, bool]:
        return {"hecho": True}

    @app.get("/api/v1/prueba/lectura")
    def lectura() -> dict[str, bool]:
        return {"hecho": True}

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client_con_ruta_exenta() -> Iterator[TestClient]:
    """Una app mínima, sin billing.router, para probar exempt_paths en aislamiento."""
    app = FastAPI()

    @app.post("/api/v1/webhooks/prueba")
    def webhook_de_prueba() -> dict[str, bool]:
        return {"hecho": True}

    @app.post("/api/v1/prueba/cambio")
    def cambio() -> dict[str, bool]:
        return {"hecho": True}

    app.add_middleware(
        SameOriginMiddleware,
        allowed_origins=[_SITIO],
        path_prefix="/api/v1",
        exempt_paths=["/api/v1/webhooks/prueba"],
    )
    with TestClient(app) as test_client:
        yield test_client


def test_una_peticion_de_la_interfaz_pasa(client: TestClient) -> None:
    response = client.post(
        "/api/v1/prueba/cambio",
        headers={SAME_ORIGIN_HEADER: "1", "Origin": _SITIO, "Sec-Fetch-Site": "same-origin"},
    )

    assert response.status_code == 200


def test_un_cliente_que_no_es_navegador_pasa_con_el_encabezado(client: TestClient) -> None:
    # curl no envía Origin ni Sec-Fetch-Site, y tampoco lleva cookies de nadie.
    assert (
        client.post("/api/v1/prueba/cambio", headers={SAME_ORIGIN_HEADER: "1"}).status_code == 200
    )


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {SAME_ORIGIN_HEADER: "0"},
        {SAME_ORIGIN_HEADER: "1", "Origin": _OTRO_SITIO},
        {SAME_ORIGIN_HEADER: "1", "Origin": "null"},
        {SAME_ORIGIN_HEADER: "1", "Sec-Fetch-Site": "cross-site"},
        {SAME_ORIGIN_HEADER: "1", "Sec-Fetch-Site": "same-site"},
    ],
    ids=[
        "sin encabezado",
        "valor distinto",
        "otro origen",
        "origen opaco",
        "desde otro sitio",
        "desde un subdominio",
    ],
)
def test_una_peticion_ajena_se_rechaza_con_403(client: TestClient, headers: dict[str, str]) -> None:
    response = client.post("/api/v1/prueba/cambio", headers=headers)

    assert response.status_code == 403
    assert response.headers["content-type"] == PROBLEM_JSON
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["detail"].startswith("La solicitud no salió de ALETHEIA.")


def test_las_lecturas_no_necesitan_el_encabezado(client: TestClient) -> None:
    assert client.get("/api/v1/prueba/lectura").status_code == 200


@pytest.mark.parametrize(
    "route",
    ["/api/v1/auth/google/register", "/api/v1/exports/download"],
)
def test_formularios_nativos_exigen_origen_y_sitio_propios(client: TestClient, route: str) -> None:
    own = client.post(
        route,
        data={"otro": "x"},
        headers={"Origin": _SITIO, "Sec-Fetch-Site": "same-origin"},
    )
    # La petición alcanza la ruta. El registro puede responder 503 en esta configuración
    # porque Google está deshabilitado; la descarga responde 422 por el formulario incompleto.
    assert own.status_code != 403
    foreign = client.post(
        route,
        data={"token": "invalido"},
        headers={"Origin": _OTRO_SITIO, "Sec-Fetch-Site": "cross-site"},
    )
    assert foreign.status_code == 403
    assert client.post(route, data={"token": "invalido"}).status_code == 403


def test_cors_solo_responde_al_origen_del_sitio(client: TestClient) -> None:
    def preflight(origen: str) -> dict[str, str]:
        response = client.options(
            "/api/v1/prueba/cambio",
            headers={
                "Origin": origen,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": SAME_ORIGIN_HEADER,
            },
        )
        return dict(response.headers)

    propio = preflight(_SITIO)
    ajeno = preflight(_OTRO_SITIO)

    assert propio["access-control-allow-origin"] == _SITIO
    assert propio["access-control-allow-credentials"] == "true"
    assert SAME_ORIGIN_HEADER.lower() in propio["access-control-allow-headers"].lower()
    assert "access-control-allow-origin" not in ajeno


def test_una_ruta_exenta_pasa_sin_ningun_encabezado(client_con_ruta_exenta: TestClient) -> None:
    # Así llega la notificación de un webhook: sin Origin, sin Sec-Fetch-Site y sin el
    # encabezado propio, porque no sale de un navegador.
    assert client_con_ruta_exenta.post("/api/v1/webhooks/prueba", json={}).status_code == 200


def test_una_ruta_no_exenta_sigue_exigiendo_el_origen(
    client_con_ruta_exenta: TestClient,
) -> None:
    assert client_con_ruta_exenta.post("/api/v1/prueba/cambio").status_code == 403
