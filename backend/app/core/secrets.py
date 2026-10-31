"""Clave de PostgreSQL leída de AWS Systems Manager Parameter Store.

Solo se usa en producción. La máquina tiene el rol de IAM aletheia-prod-instancia y boto3 toma
sus credenciales temporales del servicio de metadatos (IMDSv2), así que aquí no hay llaves.
En desarrollo y en la CI la clave sigue en backend/.env y este módulo ni se importa.
"""

from typing import TYPE_CHECKING, Final
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from pydantic import PostgresDsn, Secret

from app.core.config import DatabaseSettings

if TYPE_CHECKING:
    from mypy_boto3_ssm import SSMClient

# Si AWS no responde, la API no se queda colgada al arrancar: falla y Docker la reinicia.
_CLIENT_CONFIG: Final = Config(
    connect_timeout=5,
    read_timeout=5,
    retries={"max_attempts": 3, "mode": "standard"},
)


class SecretUnavailableError(RuntimeError):
    """No se pudo leer un parámetro; el mensaje nombra el parámetro, nunca su valor."""


def ssm_client() -> SSMClient:
    """Cliente de Parameter Store; la región sale de AWS_DEFAULT_REGION."""
    return boto3.client("ssm", config=_CLIENT_CONFIG)


def read_secure_parameter(name: str, client: SSMClient) -> str:
    """Devuelve el valor descifrado de un parámetro SecureString."""
    try:
        response = client.get_parameter(Name=name, WithDecryption=True)
    except ClientError as exc:
        # Solo el código del error (ParameterNotFound, AccessDeniedException...): basta para
        # saber qué pasó y no arrastra datos de la respuesta.
        code = exc.response.get("Error", {}).get("Code", "desconocido")
        msg = f"No se pudo leer {name} de Parameter Store ({code})."
        raise SecretUnavailableError(msg) from None
    except BotoCoreError as exc:
        # Sin región, sin credenciales del rol o sin red.
        msg = f"No se pudo leer {name} de Parameter Store ({type(exc).__name__})."
        raise SecretUnavailableError(msg) from None

    value = response["Parameter"].get("Value")
    if not value:
        msg = f"El parámetro {name} está vacío."
        raise SecretUnavailableError(msg)
    return value


def with_database_password[S: DatabaseSettings](settings: S, client: SSMClient | None = None) -> S:
    """Devuelve una copia de la configuración con la clave de Parameter Store en la URL.

    Sin parámetro configurado devuelve la misma configuración y no llama a AWS.
    """
    name = settings.database_password_parameter
    if name is None:
        return settings

    password = read_secure_parameter(name, client or ssm_client())
    url = settings.database_url.get_secret_value()
    # La configuración ya validó que hay un solo servidor y que la URL no trae clave.
    host = url.hosts()[0]
    if host["host"] is None:
        # PostgresDsn exige servidor, así que esto no ocurre; mypy necesita verlo descartado.
        msg = "La URL de PostgreSQL no tiene servidor."
        raise ValueError(msg)
    full_url = PostgresDsn.build(
        scheme=url.scheme,
        username=host["username"],
        # Codificada: una clave con / : @ o % no debe partir la URL.
        password=quote(password, safe=""),
        host=host["host"],
        port=host["port"],
        path=(url.path or "").removeprefix("/"),
        query=url.query,
    )
    # La copia conserva Secret: la URL completa tampoco aparece en repr ni en registros.
    return settings.model_copy(update={"database_url": Secret[PostgresDsn](full_url)})
