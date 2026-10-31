"""Pruebas de la carga y validación de la configuración."""

import pytest
from pydantic import ValidationError

from app.core.config import MigrationSettings, Settings

_URL = "postgresql+psycopg://aletheia:clave-de-prueba@localhost:5432/aletheia"


@pytest.fixture(autouse=True)
def _entorno_limpio(monkeypatch: pytest.MonkeyPatch) -> None:
    """Aísla cada prueba de las variables ALETHEIA_ del equipo o de la CI."""
    for nombre in (
        "ENVIRONMENT",
        "LOG_LEVEL",
        "DATABASE_URL",
        "DATABASE_PASSWORD_PARAMETER",
        "MIGRATION_DATABASE_URL",
        "MIGRATION_DATABASE_PASSWORD_PARAMETER",
    ):
        monkeypatch.delenv(f"ALETHEIA_{nombre}", raising=False)


def _cargar() -> Settings:
    # _env_file=None ignora un .env local para que la prueba solo vea el entorno.
    return Settings(_env_file=None)


def test_carga_valores_desde_el_entorno(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALETHEIA_DATABASE_URL", _URL)
    monkeypatch.setenv("ALETHEIA_ENVIRONMENT", "test")

    settings = _cargar()

    assert settings.environment == "test"
    assert settings.log_level == "INFO"
    assert str(settings.database_url.get_secret_value()) == _URL


def test_falta_variable_obligatoria_la_nombra() -> None:
    with pytest.raises(ValidationError) as error:
        _cargar()

    assert error.value.errors()[0]["loc"] == ("database_url",)
    assert error.value.errors()[0]["type"] == "missing"


def test_valor_invalido_no_aparece_en_el_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALETHEIA_DATABASE_URL", "postgresql://aletheia:clave-secreta@db/aletheia")

    with pytest.raises(ValidationError) as error:
        _cargar()

    assert "clave-secreta" not in str(error.value)
    assert "postgresql+psycopg" in str(error.value)


def test_la_url_no_se_expone_en_repr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALETHEIA_DATABASE_URL", _URL)
    settings = _cargar()
    assert "clave-de-prueba" not in repr(settings)


@pytest.mark.parametrize("entorno", ["test", "production"])
def test_debug_solo_en_desarrollo(monkeypatch: pytest.MonkeyPatch, entorno: str) -> None:
    monkeypatch.setenv("ALETHEIA_DATABASE_URL", _URL)
    monkeypatch.setenv("ALETHEIA_ENVIRONMENT", entorno)
    monkeypatch.setenv("ALETHEIA_LOG_LEVEL", "DEBUG")

    with pytest.raises(ValidationError, match="DEBUG solo se permite"):
        _cargar()


def test_migraciones_no_usan_la_url_de_la_api(monkeypatch: pytest.MonkeyPatch) -> None:
    # La API y las migraciones se conectan con usuarios distintos: una no hereda la otra.
    monkeypatch.setenv("ALETHEIA_DATABASE_URL", _URL)

    with pytest.raises(ValidationError) as error:
        MigrationSettings(_env_file=None)

    assert error.value.errors()[0]["loc"] == ("database_url",)


def test_migraciones_cargan_su_url_y_exigen_psycopg(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALETHEIA_MIGRATION_DATABASE_URL", _URL)
    assert str(MigrationSettings(_env_file=None).database_url.get_secret_value()) == _URL

    monkeypatch.setenv("ALETHEIA_MIGRATION_DATABASE_URL", "postgresql://dueno:clave-secreta@db/x")
    with pytest.raises(ValidationError) as error:
        MigrationSettings(_env_file=None)

    assert "clave-secreta" not in str(error.value)
