"""Pruebas del adaptador de llaves: KMS en producción y una llave RSA local en el resto."""

from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

import pytest
from botocore.exceptions import ClientError
from pydantic import ValidationError

from app.adapters.keys import (
    KMS_KEY_ALIAS,
    KeyWrapperError,
    KmsKeyWrapper,
    LocalKeyWrapper,
    build_key_wrapper,
)
from app.core.config import Settings
from tests.conftest import TEST_SIGNING_KEY

if TYPE_CHECKING:
    from mypy_boto3_kms import KMSClient

_ARN = "arn:aws:kms:us-east-1:111122223333:key/11111111-2222-3333-4444-555555555555"


class _FakeKms:
    """Cliente de KMS que anota los argumentos y devuelve una respuesta fija."""

    def __init__(self, error: Exception | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self._error = error

    def encrypt(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        if self._error is not None:
            raise self._error
        return {"CiphertextBlob": b"envuelta", "KeyId": _ARN}


def _local(key_path: Path) -> LocalKeyWrapper:
    return LocalKeyWrapper.from_pem_file(key_path)


def test_la_llave_local_envuelve_y_recupera_la_misma_llave(local_key_path: Path) -> None:
    wrapper = _local(local_key_path)

    wrapped = wrapper.wrap(b"x" * 131)

    assert len(wrapped.ciphertext) == 384
    assert wrapped.key_version.startswith("local:")
    assert len(wrapped.key_version) == 6 + 16
    assert wrapper.unwrap(wrapped) == b"x" * 131


def test_la_version_local_no_cambia_entre_llamadas(local_key_path: Path) -> None:
    wrapper = _local(local_key_path)

    first = wrapper.wrap(b"llave")
    second = wrapper.wrap(b"llave")

    assert first.key_version == second.key_version
    assert first.ciphertext != second.ciphertext


def test_una_llave_envuelta_alterada_no_se_recupera(local_key_path: Path) -> None:
    wrapper = _local(local_key_path)
    wrapped = wrapper.wrap(b"llave")
    tampered = bytearray(wrapped.ciphertext)
    tampered[0] ^= 1

    with pytest.raises(KeyWrapperError):
        wrapper.unwrap(type(wrapped)(bytes(tampered), wrapped.key_version))


def test_kms_usa_oaep_sha256_y_la_llave_de_produccion() -> None:
    kms = _FakeKms()
    wrapper = KmsKeyWrapper(cast("KMSClient", kms), KMS_KEY_ALIAS)

    wrapped = wrapper.wrap(b"llave")

    assert kms.calls == [
        {
            "KeyId": KMS_KEY_ALIAS,
            "Plaintext": b"llave",
            "EncryptionAlgorithm": "RSAES_OAEP_SHA_256",
        }
    ]
    assert wrapped.ciphertext == b"envuelta"
    assert wrapped.key_version == _ARN


def test_kms_que_falla_lanza_key_wrapper_error() -> None:
    error = ClientError({"Error": {"Code": "ThrottlingException", "Message": "x"}}, "Encrypt")
    wrapper = KmsKeyWrapper(cast("KMSClient", _FakeKms(error)), KMS_KEY_ALIAS)

    with pytest.raises(KeyWrapperError):
        wrapper.wrap(b"llave")


def test_produccion_rechaza_la_llave_local(local_key_path: Path) -> None:
    with pytest.raises(ValidationError, match="llave local"):
        Settings.model_validate(
            {
                "environment": "production",
                "log_level": "INFO",
                "database_url": "postgresql+psycopg://aletheia_app@postgres:5432/aletheia",
                "database_password_parameter": "/aletheia/prod/postgres/app-password",
                "token_signing_key_parameter": "/aletheia/prod/app/token-signing-key",
                "local_key_path": local_key_path,
            }
        )


def test_fuera_de_produccion_se_usa_la_llave_local(settings: Settings) -> None:
    assert isinstance(build_key_wrapper(settings), LocalKeyWrapper)


def test_sin_ruta_de_llave_local_el_error_explica_como_generarla() -> None:
    settings = Settings.model_validate(
        {
            "environment": "test",
            "log_level": "INFO",
            "local_key_path": None,
            "database_url": "postgresql+psycopg://a:b@localhost:5432/x",
            "token_signing_key": TEST_SIGNING_KEY,
        }
    )

    with pytest.raises(RuntimeError, match="ALETHEIA_LOCAL_KEY_PATH"):
        build_key_wrapper(settings)
