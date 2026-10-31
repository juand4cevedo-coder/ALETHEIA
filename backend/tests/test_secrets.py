"""Pruebas de la clave de PostgreSQL leída de Parameter Store.

No van a AWS: el Stubber de botocore responde en lugar del servicio y comprueba que la
petición sea exactamente la esperada.
"""

from collections.abc import Iterator
from typing import TYPE_CHECKING

import boto3
import pytest
from botocore.stub import Stubber
from pydantic import ValidationError
from sqlalchemy import make_url

from app.core import config, secrets
from app.core.config import MigrationSettings, Settings, get_settings
from app.core.secrets import SecretUnavailableError, with_database_password

if TYPE_CHECKING:
    from mypy_boto3_ssm import SSMClient

_PARAMETRO = "/aletheia/prod/postgres/app-password"
_URL_SIN_CLAVE = "postgresql+psycopg://aletheia_app@postgres:5432/aletheia"
_CLAVE = "ClaveDePrueba40Caracteres0123456789abcde"
_VARIABLES = (
    "ENVIRONMENT",
    "LOG_LEVEL",
    "DATABASE_URL",
    "DATABASE_PASSWORD_PARAMETER",
    "MIGRATION_DATABASE_URL",
    "MIGRATION_DATABASE_PASSWORD_PARAMETER",
)


@pytest.fixture(autouse=True)
def _entorno_limpio(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Aísla cada prueba de las variables del equipo y de la configuración en caché."""
    for nombre in _VARIABLES:
        monkeypatch.delenv(f"ALETHEIA_{nombre}", raising=False)
    # Sin .env local: la prueba solo ve lo que ella misma define.
    monkeypatch.setitem(config.Settings.model_config, "env_file", None)
    monkeypatch.setitem(config.MigrationSettings.model_config, "env_file", None)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def cliente() -> SSMClient:
    # Credenciales y región ficticias: el Stubber intercepta la llamada antes de la red.
    return boto3.client(
        "ssm",
        region_name="us-east-2",
        aws_access_key_id="prueba",
        aws_secret_access_key="prueba",  # noqa: S106
    )


def _respuesta(valor: str) -> dict[str, object]:
    return {"Parameter": {"Name": _PARAMETRO, "Type": "SecureString", "Value": valor}}


def _produccion(**extra: str) -> Settings:
    return Settings.model_validate(
        {
            "environment": "production",
            "database_url": _URL_SIN_CLAVE,
            "database_password_parameter": _PARAMETRO,
            **extra,
        }
    )


# --- Lectura del parámetro --------------------------------------------------------------


def test_arma_la_url_con_la_clave_del_parametro(cliente: SSMClient) -> None:
    with Stubber(cliente) as stub:
        stub.add_response(
            "get_parameter", _respuesta(_CLAVE), {"Name": _PARAMETRO, "WithDecryption": True}
        )
        settings = with_database_password(_produccion(), cliente)
        stub.assert_no_pending_responses()

    url = make_url(settings.database_url.get_secret_value().encoded_string())
    assert (url.username, url.password, url.host, url.port, url.database) == (
        "aletheia_app",
        _CLAVE,
        "postgres",
        5432,
        "aletheia",
    )
    assert _CLAVE not in repr(settings)


def test_una_clave_con_simbolos_no_parte_la_url(cliente: SSMClient) -> None:
    clave = "a/b:c@d%e?f#g"
    with Stubber(cliente) as stub:
        stub.add_response("get_parameter", _respuesta(clave))
        settings = with_database_password(_produccion(), cliente)

    url = make_url(settings.database_url.get_secret_value().encoded_string())
    assert (url.password, url.host, url.database) == (clave, "postgres", "aletheia")


def test_sin_parametro_no_llama_a_aws(cliente: SSMClient) -> None:
    settings = Settings.model_validate(
        {"environment": "test", "database_url": "postgresql+psycopg://a:b@localhost/x"}
    )
    # Sin respuestas cargadas: cualquier llamada haría fallar al Stubber.
    with Stubber(cliente):
        assert with_database_password(settings, cliente) is settings


@pytest.mark.parametrize("codigo", ["ParameterNotFound", "AccessDeniedException"])
def test_un_error_de_aws_nombra_el_parametro_y_el_codigo(cliente: SSMClient, codigo: str) -> None:
    with Stubber(cliente) as stub:
        stub.add_client_error("get_parameter", service_error_code=codigo)
        with pytest.raises(SecretUnavailableError) as error:
            with_database_password(_produccion(), cliente)

    assert str(error.value) == f"No se pudo leer {_PARAMETRO} de Parameter Store ({codigo})."


def test_un_parametro_vacio_se_rechaza(cliente: SSMClient) -> None:
    with Stubber(cliente) as stub:
        stub.add_response("get_parameter", _respuesta(""))
        with pytest.raises(SecretUnavailableError, match="está vacío"):
            with_database_password(_produccion(), cliente)


def test_las_migraciones_leen_su_propio_parametro(
    cliente: SSMClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = "/aletheia/prod/postgres/owner-password"
    monkeypatch.setenv(
        "ALETHEIA_MIGRATION_DATABASE_URL",
        "postgresql+psycopg://aletheia_owner@postgres:5432/aletheia",
    )
    monkeypatch.setenv("ALETHEIA_MIGRATION_DATABASE_PASSWORD_PARAMETER", owner)

    with Stubber(cliente) as stub:
        stub.add_response(
            "get_parameter", _respuesta(_CLAVE), {"Name": owner, "WithDecryption": True}
        )
        settings = with_database_password(MigrationSettings(), cliente)

    assert make_url(settings.database_url.get_secret_value().encoded_string()).password == _CLAVE


def test_get_settings_lee_la_clave_al_arrancar_en_produccion(
    cliente: SSMClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ALETHEIA_ENVIRONMENT", "production")
    monkeypatch.setenv("ALETHEIA_DATABASE_URL", _URL_SIN_CLAVE)
    monkeypatch.setenv("ALETHEIA_DATABASE_PASSWORD_PARAMETER", _PARAMETRO)
    monkeypatch.setattr(secrets, "ssm_client", lambda: cliente)

    with Stubber(cliente) as stub:
        stub.add_response("get_parameter", _respuesta(_CLAVE))
        settings = get_settings()

    assert make_url(settings.database_url.get_secret_value().encoded_string()).password == _CLAVE


# --- Reglas de la configuración ---------------------------------------------------------


def test_produccion_exige_el_parametro() -> None:
    with pytest.raises(ValidationError, match="falta el parámetro"):
        Settings.model_validate({"environment": "production", "database_url": _URL_SIN_CLAVE})


@pytest.mark.parametrize("entorno", ["development", "test"])
def test_fuera_de_produccion_no_se_usa_parameter_store(entorno: str) -> None:
    with pytest.raises(ValidationError, match="solo se lee de Parameter Store"):
        _produccion(environment=entorno)


def test_con_parametro_la_url_no_puede_traer_clave() -> None:
    with pytest.raises(ValidationError, match="no debe incluir la clave") as error:
        _produccion(database_url="postgresql+psycopg://aletheia_app:otra@postgres/aletheia")

    assert "otra" not in str(error.value)


@pytest.mark.parametrize("nombre", ["aletheia/prod/clave", "/aletheia/prod/", "/clave con espacio"])
def test_el_nombre_del_parametro_debe_ser_una_ruta(nombre: str) -> None:
    with pytest.raises(ValidationError):
        _produccion(database_password_parameter=nombre)
