"""El intercambio con Google explica por qué falla, sin exponer secretos."""

import io
import urllib.error
import urllib.request
from email.message import Message

import pytest

from app.adapters.google_oidc import GoogleOidcClient, GoogleOidcError


def _cliente() -> GoogleOidcClient:
    return GoogleOidcClient(
        client_id="cliente.apps.googleusercontent.com",
        client_secret="secreto-de-prueba",  # noqa: S106
        redirect_uri="https://aletheia.sbs/api/v1/auth/google/callback",
    )


def _rechazo(cuerpo: bytes) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(
        "https://oauth2.googleapis.com/token", 400, "Bad Request", Message(), io.BytesIO(cuerpo)
    )


def test_un_rechazo_de_google_conserva_solo_el_codigo_del_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def falsa(*_a: object, **_k: object) -> object:
        raise _rechazo(b'{"error": "invalid_client", "error_description": "secreto-de-prueba"}')

    monkeypatch.setattr(urllib.request, "urlopen", falsa)

    with pytest.raises(GoogleOidcError) as error:
        _cliente().exchange(code="c", code_verifier="v", nonce="n")

    assert error.value.reason == "Google respondió 400: invalid_client"
    assert "secreto-de-prueba" not in str(error.value)


def test_un_rechazo_sin_json_no_rompe_el_diagnostico(monkeypatch: pytest.MonkeyPatch) -> None:
    def falsa(*_a: object, **_k: object) -> object:
        raise _rechazo(b"<html>no es json</html>")

    monkeypatch.setattr(urllib.request, "urlopen", falsa)

    with pytest.raises(GoogleOidcError) as error:
        _cliente().exchange(code="c", code_verifier="v", nonce="n")

    assert error.value.reason == "Google respondió 400: sin detalle"
