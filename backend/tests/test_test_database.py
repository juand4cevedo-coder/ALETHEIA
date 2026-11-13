"""La suite no puede reconstruir una base distinta de la reservada para pruebas."""

import pytest

from tests.conftest import (
    TEST_DATABASE_URL_VARIABLE,
    TEST_MIGRATION_DATABASE_URL_VARIABLE,
    _required_url,
)


@pytest.mark.parametrize(
    "variable", [TEST_DATABASE_URL_VARIABLE, TEST_MIGRATION_DATABASE_URL_VARIABLE]
)
@pytest.mark.parametrize(
    "url",
    [
        "postgresql://usuario:secreto@localhost/aletheia",
        "postgresql://usuario:secreto@produccion.example/aletheia_test",
        "postgresql://usuario:secreto@localhost/aletheia_test?host=produccion.example",
        "postgresql://usuario:secreto@localhost/aletheia_test?dbname=aletheia",
        "postgresql://usuario:secreto@localhost/aletheia_test?service=produccion",
        "sqlite:///aletheia_test",
        "url-invalida-con-secreto",
    ],
)
def test_rechaza_destinos_inseguros_sin_exponer_la_url(
    monkeypatch: pytest.MonkeyPatch, variable: str, url: str
) -> None:
    monkeypatch.setenv(variable, url)
    with pytest.raises(pytest.fail.Exception) as error:
        _required_url(variable)
    assert variable in str(error.value)
    assert "secreto" not in str(error.value)
    assert url not in str(error.value)


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "[::1]"])
@pytest.mark.parametrize("driver", ["postgresql", "postgresql+psycopg"])
def test_acepta_la_base_local_de_pruebas(
    monkeypatch: pytest.MonkeyPatch, host: str, driver: str
) -> None:
    monkeypatch.setenv(
        TEST_DATABASE_URL_VARIABLE, f"{driver}://usuario:prueba@{host}:5432/aletheia_test"
    )
    assert _required_url(TEST_DATABASE_URL_VARIABLE) == (
        f"postgresql+psycopg://usuario:prueba@{host}:5432/aletheia_test"
    )
