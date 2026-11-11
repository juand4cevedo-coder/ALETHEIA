"""Envoltura de las llaves de los casos (INT-05): AWS KMS en producción y una llave RSA local
en desarrollo y pruebas.

Cada caso tiene su propia llave de datos (un keyset de Tink). Antes de guardarla en la base se
envuelve con la llave maestra y con RSA-OAEP-256, el algoritmo que KMS ofrece para sus llaves
RSA. La llave maestra de producción nunca sale de KMS. Ninguna función de este módulo registra
la llave en claro ni la devuelve en un error.
"""

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final, Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.core.config import Settings

if TYPE_CHECKING:
    from mypy_boto3_kms import KMSClient

# Llave asimétrica RSA-3072 de producción, de uso ENCRYPT_DECRYPT.
KMS_KEY_ALIAS: Final = "alias/aletheia-prod-maestra"
_KMS_ALGORITHM: Final = "RSAES_OAEP_SHA_256"
_LOCAL_PREFIX: Final = "local:"
# Primeros caracteres hexadecimales de la huella de la llave pública que se guardan como versión.
_LOCAL_VERSION_LENGTH: Final = 16
# Igual que spikes/tt006/cifrado_tink.py: OAEP con MGF1(SHA-256), SHA-256 y sin etiqueta.
_OAEP: Final = padding.OAEP(
    mgf=padding.MGF1(algorithm=hashes.SHA256()),
    algorithm=hashes.SHA256(),
    label=None,
)

# Si KMS no responde, la creación del caso falla pronto en lugar de colgar la petición.
_KMS_CLIENT_CONFIG: Final = Config(
    connect_timeout=5,
    read_timeout=10,
    retries={"max_attempts": 3, "mode": "standard"},
)


@dataclass(frozen=True, slots=True)
class WrappedKey:
    """Una llave de caso envuelta y la versión de la llave maestra que la envolvió."""

    ciphertext: bytes
    key_version: str


class KeyWrapperError(RuntimeError):
    """KMS no respondió o rechazó la operación, o la llave envuelta no se puede recuperar.

    El mensaje nombra la causa, nunca el contenido de la llave.
    """


class KeyWrapper(Protocol):
    """Lo único que el resto del backend sabe de la llave maestra."""

    def wrap(self, plaintext: bytes) -> WrappedKey:
        """Envuelve la llave de un caso o lanza KeyWrapperError."""
        ...

    def unwrap(self, wrapped: WrappedKey) -> bytes:
        """Recupera la llave de un caso o lanza KeyWrapperError."""
        ...


class LocalKeyWrapper:
    """Envuelve con una llave RSA en un archivo PEM. Solo para desarrollo y pruebas."""

    def __init__(self, private_key: rsa.RSAPrivateKey) -> None:
        self._private_key = private_key
        public_der = private_key.public_key().public_bytes(
            serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
        )
        # La versión depende de la llave pública: cambiar el archivo cambia la versión.
        digest = hashlib.sha256(public_der).hexdigest()
        self._key_version = _LOCAL_PREFIX + digest[:_LOCAL_VERSION_LENGTH]

    @classmethod
    def from_pem_file(cls, path: Path) -> LocalKeyWrapper:
        """Lee una llave privada RSA sin contraseña de un archivo PEM."""
        try:
            key = serialization.load_pem_private_key(path.read_bytes(), password=None)
        except (OSError, ValueError, TypeError) as exc:
            msg = f"No se pudo leer la llave local {path} ({type(exc).__name__})."
            raise KeyWrapperError(msg) from None
        if not isinstance(key, rsa.RSAPrivateKey):
            msg = f"La llave local {path} no es una llave RSA."
            raise KeyWrapperError(msg)
        return cls(key)

    def wrap(self, plaintext: bytes) -> WrappedKey:
        ciphertext = self._private_key.public_key().encrypt(plaintext, _OAEP)
        return WrappedKey(ciphertext=ciphertext, key_version=self._key_version)

    def unwrap(self, wrapped: WrappedKey) -> bytes:
        try:
            return self._private_key.decrypt(wrapped.ciphertext, _OAEP)
        except ValueError:
            msg = "La llave envuelta está alterada o no corresponde a esta llave local."
            raise KeyWrapperError(msg) from None


class KmsKeyWrapper:
    """Envuelve con la llave RSA de AWS KMS y las credenciales del rol de la máquina."""

    def __init__(self, client: KMSClient, key_id: str) -> None:
        self._client = client
        self._key_id = key_id

    def wrap(self, plaintext: bytes) -> WrappedKey:
        try:
            response = self._client.encrypt(
                KeyId=self._key_id,
                Plaintext=plaintext,
                EncryptionAlgorithm=_KMS_ALGORITHM,
            )
        except ClientError as exc:
            # Solo el código del error: la respuesta no debe repetir datos de la llave.
            code = exc.response.get("Error", {}).get("Code", "desconocido")
            msg = f"AWS KMS no envolvió la llave ({code})."
            raise KeyWrapperError(msg) from None
        except BotoCoreError as exc:
            msg = f"No se pudo llegar a AWS KMS ({type(exc).__name__})."
            raise KeyWrapperError(msg) from None
        # KeyId es el ARN de la versión concreta de la llave que envolvió.
        return WrappedKey(ciphertext=response["CiphertextBlob"], key_version=response["KeyId"])

    def unwrap(self, wrapped: WrappedKey) -> bytes:
        try:
            response = self._client.decrypt(
                KeyId=wrapped.key_version,
                CiphertextBlob=wrapped.ciphertext,
                EncryptionAlgorithm=_KMS_ALGORITHM,
            )
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "desconocido")
            msg = f"AWS KMS no recuperó la llave ({code})."
            raise KeyWrapperError(msg) from None
        except BotoCoreError as exc:
            msg = f"No se pudo llegar a AWS KMS ({type(exc).__name__})."
            raise KeyWrapperError(msg) from None
        return response["Plaintext"]


def kms_client() -> KMSClient:
    """Cliente de AWS KMS; la región sale de AWS_DEFAULT_REGION."""
    return boto3.client("kms", config=_KMS_CLIENT_CONFIG)


def build_key_wrapper(settings: Settings) -> KeyWrapper:
    """AWS KMS en producción y la llave local en cualquier otro entorno, sin excepciones: así
    un equipo de desarrollo nunca toca la llave maestra y producción nunca usa un archivo."""
    if settings.environment == "production":
        return KmsKeyWrapper(kms_client(), KMS_KEY_ALIAS)
    if settings.local_key_path is None:
        msg = (
            "Falta ALETHEIA_LOCAL_KEY_PATH con la llave local para envolver las llaves de los "
            "casos. Genere una con el comando del README (sección Backend) y apunte la "
            "variable a infra/dev-key.pem."
        )
        raise RuntimeError(msg)
    return LocalKeyWrapper.from_pem_file(settings.local_key_path)
