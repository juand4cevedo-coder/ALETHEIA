"""Configuración del backend, leída de variables de entorno con prefijo ALETHEIA_."""

from functools import lru_cache
from pathlib import Path
from typing import Final, Literal, Self

from pydantic import Field, PostgresDsn, Secret, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "test", "production"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR"]

_DRIVER_SCHEME = "postgresql+psycopg"
# Ruta de un parámetro de Parameter Store, por ejemplo /aletheia/prod/postgres/app-password.
_PARAMETER_PATTERN = r"^(/[A-Za-z0-9_.-]+)+$"
# Dirección del sitio en producción: los enlaces de los correos siempre llevan a ella.
PRODUCTION_URL: Final = "https://aletheia.sbs"
MIN_SIGNING_KEY_LENGTH: Final = 32


class SigningKeyMissingError(RuntimeError):
    """Falta ALETHEIA_TOKEN_SIGNING_KEY: sin ella no se firman enlaces ni sesiones."""


class DatabaseSettings(BaseSettings):
    """Reglas comunes a toda configuración que lleva una URL de PostgreSQL."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
        # Compose representa las variables opcionales ausentes como texto vacío.
        env_ignore_empty=True,
        # Un valor inválido no se repite en el mensaje de error: puede ser un secreto.
        hide_input_in_errors=True,
    )

    # Secret evita que la URL, que incluye la contraseña, aparezca en repr o en registros.
    database_url: Secret[PostgresDsn] = Field(
        description="URL de PostgreSQL con el controlador psycopg 3.",
    )
    # Solo en producción. La URL llega sin clave y la clave se lee de Parameter Store al
    # arrancar (app.core.secrets), con el rol de la máquina: no queda en ningún archivo.
    database_password_parameter: str | None = Field(
        default=None,
        pattern=_PARAMETER_PATTERN,
        description="Parámetro SecureString con la clave del usuario de la URL.",
    )

    @field_validator("database_url")
    @classmethod
    def _require_psycopg_driver(cls, value: Secret[PostgresDsn]) -> Secret[PostgresDsn]:
        # Sin el sufijo +psycopg, SQLAlchemy buscaría psycopg2, que no está instalado.
        if value.get_secret_value().scheme != _DRIVER_SCHEME:
            msg = f"debe usar el esquema {_DRIVER_SCHEME}://"
            raise ValueError(msg)
        return value

    @model_validator(mode="after")
    def _password_from_one_place(self) -> Self:
        # Con el parámetro, la clave solo puede venir de Parameter Store: una clave en la URL
        # significaría que alguien la dejó en la configuración del contenedor.
        url = self.database_url.get_secret_value()
        if self.database_password_parameter is not None:
            if len(url.hosts()) != 1:
                msg = "la URL debe tener un solo servidor cuando la clave viene de Parameter Store"
                raise ValueError(msg)
            if url.hosts()[0]["password"] is not None:
                msg = "la URL no debe incluir la clave cuando se lee de Parameter Store"
                raise ValueError(msg)
        return self


class Settings(DatabaseSettings):
    """Valores que la API necesita para arrancar; los obligatorios no tienen valor por defecto."""

    model_config = SettingsConfigDict(env_prefix="ALETHEIA_")

    environment: Environment = "development"
    log_level: LogLevel = "INFO"
    # Mailpit de infra/compose.dev.yaml o de la CI. En production el correo sale por Amazon
    # SES (app.adapters.email) y estos dos valores no se usan.
    smtp_host: str = "127.0.0.1"
    smtp_port: int = Field(default=1025, ge=1, le=65535)
    # Dirección del sitio en los enlaces de los correos fuera de producción. En production es
    # siempre https://aletheia.sbs (public_url más abajo) y este valor no se usa.
    dev_public_url: str = "http://localhost:5173"
    # Clave maestra de los tokens firmados (app.core.tokens). Fuera de producción va en
    # backend/.env; en production se lee de Parameter Store con el parámetro de abajo.
    token_signing_key: Secret[str] | None = Field(
        default=None,
        description=f"Clave de al menos {MIN_SIGNING_KEY_LENGTH} caracteres aleatorios.",
    )
    token_signing_key_parameter: str | None = Field(
        default=None,
        pattern=_PARAMETER_PATTERN,
        description="Parámetro SecureString con la clave de firma de los tokens.",
    )

    # OpenID Connect de Google. El identificador es público; el secreto nunca sale del
    # backend y, en producción, se obtiene de Parameter Store como las demás credenciales.
    google_client_id: str | None = Field(default=None, min_length=1, max_length=255)
    google_client_secret: Secret[str] | None = None
    google_client_secret_parameter: str | None = Field(
        default=None,
        pattern=_PARAMETER_PATTERN,
        description="Parámetro SecureString con el secreto OAuth de Google.",
    )

    # Llave RSA-3072 en PEM con la que se envuelven las llaves de los casos fuera de producción
    # (app.adapters.keys). En production la llave maestra vive en AWS KMS y este campo no se usa.
    local_key_path: Path | None = Field(
        default=None,
        description="Ruta del PEM de la llave maestra local; solo fuera de production.",
    )

    # Bucket S3 de evidencias y paquetes de exportación (app.adapters.evidence_storage y
    # export_storage). Solo se usa en production; fuera de ella el almacenamiento es local.
    evidence_bucket: str | None = Field(
        default=None,
        description="Bucket S3 de evidencias y exportaciones; obligatorio en production.",
    )

    def evidence_bucket_name(self) -> str:
        """El bucket de evidencias, o un error claro si el entorno no lo tiene."""
        if self.evidence_bucket is None:
            msg = "Falta ALETHEIA_EVIDENCE_BUCKET para leer o escribir evidencia en S3."
            raise RuntimeError(msg)
        return self.evidence_bucket

    # Pasarela de pagos (HU-027, ADR-010). La llave pública identifica el comercio ante Wompi
    # al pedir los tokens de aceptación; las otras tres nunca salen del backend. En sandbox
    # llevan los prefijos pub_test_/prv_test_/test_integrity_/test_events_; en producción,
    # pub_prod_/prv_prod_/prod_integrity_/prod_events_. Por ahora viven en variables de
    # entorno en todos los entornos; pasarlas a Parameter Store queda para cuando haya una
    # cuenta real de Wompi, igual que la clave de PostgreSQL.
    wompi_public_key: str | None = Field(
        default=None, description="Llave pública de Wompi (pub_test_... o pub_prod_...)."
    )
    wompi_private_key: Secret[str] | None = Field(
        default=None, description="Llave privada de Wompi; solo el backend la usa."
    )
    wompi_integrity_secret: Secret[str] | None = Field(
        default=None, description="Secreto de integridad de Wompi, para firmar transacciones."
    )
    wompi_events_secret: Secret[str] | None = Field(
        default=None, description="Secreto de eventos de Wompi, para verificar sus webhooks."
    )
    # En producción las tres llaves secretas se leen de Parameter Store, como las demás
    # credenciales: el contenedor solo recibe el nombre de cada parámetro. La llave pública no es
    # secreta y va en ALETHEIA_WOMPI_PUBLIC_KEY.
    wompi_private_key_parameter: str | None = Field(
        default=None,
        pattern=_PARAMETER_PATTERN,
        description="Parámetro SecureString con la llave privada de Wompi.",
    )
    wompi_integrity_secret_parameter: str | None = Field(
        default=None,
        pattern=_PARAMETER_PATTERN,
        description="Parámetro SecureString con el secreto de integridad de Wompi.",
    )
    wompi_events_secret_parameter: str | None = Field(
        default=None,
        pattern=_PARAMETER_PATTERN,
        description="Parámetro SecureString con el secreto de eventos de Wompi.",
    )

    @field_validator(
        "wompi_public_key",
        "wompi_private_key_parameter",
        "wompi_integrity_secret_parameter",
        "wompi_events_secret_parameter",
        mode="before",
    )
    @classmethod
    def _blank_wompi_is_unset(cls, value: object) -> object:
        # Compose pasa estas variables siempre; sin Wompi configurado llegan vacías.
        return None if isinstance(value, str) and not value.strip() else value

    @property
    def public_url(self) -> str:
        """Dirección pública del sitio, sin barra final, para armar los enlaces de los correos."""
        if self.environment == "production":
            return PRODUCTION_URL
        return self.dev_public_url.rstrip("/")

    def signing_key(self) -> str:
        """La clave maestra de los tokens firmados, o un error claro si el entorno no la tiene.

        En producción ya llega leída de Parameter Store (app.core.secrets).
        """
        if self.token_signing_key is None:
            msg = "Falta ALETHEIA_TOKEN_SIGNING_KEY para firmar los enlaces y las sesiones."
            raise SigningKeyMissingError(msg)
        return self.token_signing_key.get_secret_value()

    @field_validator("token_signing_key")
    @classmethod
    def _long_signing_key(cls, value: Secret[str] | None) -> Secret[str] | None:
        # Una clave corta se puede adivinar probando: con 32 caracteres aleatorios ya no.
        if value is not None and len(value.get_secret_value()) < MIN_SIGNING_KEY_LENGTH:
            msg = f"debe tener al menos {MIN_SIGNING_KEY_LENGTH} caracteres"
            raise ValueError(msg)
        return value

    @field_validator("google_client_secret")
    @classmethod
    def _nonempty_google_secret(cls, value: Secret[str] | None) -> Secret[str] | None:
        if value is not None and not value.get_secret_value():
            raise ValueError("no puede estar vacío")
        return value

    @model_validator(mode="after")
    def _debug_only_in_development(self) -> Self:
        # El nivel DEBUG puede volcar datos internos: solo se permite en desarrollo.
        if self.log_level == "DEBUG" and self.environment != "development":
            msg = "log_level DEBUG solo se permite con environment development"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _production_reads_parameter_store(self) -> Self:
        # Producción nunca recibe la clave en una variable; el resto de entornos nunca va a AWS.
        from_store = self.database_password_parameter is not None
        if self.environment == "production" and not from_store:
            msg = "en production la clave se lee de Parameter Store: falta el parámetro"
            raise ValueError(msg)
        if self.environment != "production" and from_store:
            msg = "la clave solo se lee de Parameter Store con environment production"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _production_has_no_local_key(self) -> Self:
        # Una llave maestra en un archivo no protege nada: en producción solo manda KMS.
        if self.environment == "production" and self.local_key_path is not None:
            msg = "la llave local solo se usa fuera de production: ahí la maestra vive en KMS"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _evidence_bucket_only_in_production(self) -> Self:
        if self.environment == "production" and self.evidence_bucket is None:
            msg = "en production falta ALETHEIA_EVIDENCE_BUCKET"
            raise ValueError(msg)
        if self.environment != "production" and self.evidence_bucket is not None:
            msg = "el bucket de evidencias solo se usa con environment production"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _signing_key_from_one_place(self) -> Self:
        # La misma regla que la clave de la base: en producción solo desde Parameter Store.
        if self.environment == "production":
            if self.token_signing_key_parameter is None:
                msg = (
                    "en production la clave de firma se lee de Parameter Store: falta el parámetro"
                )
                raise ValueError(msg)
            if self.token_signing_key is not None:
                msg = "en production la clave de firma no puede venir en una variable"
                raise ValueError(msg)
        elif self.token_signing_key_parameter is not None:
            msg = "la clave de firma solo se lee de Parameter Store con environment production"
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _google_credentials_from_one_place(self) -> Self:
        configured = self.google_client_id is not None
        if not configured and (
            self.google_client_secret is not None or self.google_client_secret_parameter is not None
        ):
            msg = "el secreto de Google exige ALETHEIA_GOOGLE_CLIENT_ID"
            raise ValueError(msg)
        if self.environment == "production":
            if self.google_client_secret is not None:
                msg = "en production el secreto de Google no puede venir en una variable"
                raise ValueError(msg)
            if configured and self.google_client_secret_parameter is None:
                msg = "en production el secreto de Google se lee de Parameter Store"
                raise ValueError(msg)
        else:
            if self.google_client_secret_parameter is not None:
                msg = "el secreto de Google solo se lee de Parameter Store en production"
                raise ValueError(msg)
            if configured and self.google_client_secret is None:
                msg = "falta ALETHEIA_GOOGLE_CLIENT_SECRET"
                raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _wompi_credentials_from_one_place(self) -> Self:
        parametros = (
            self.wompi_private_key_parameter,
            self.wompi_integrity_secret_parameter,
            self.wompi_events_secret_parameter,
        )
        secretos = (
            self.wompi_private_key,
            self.wompi_integrity_secret,
            self.wompi_events_secret,
        )
        if self.environment == "production":
            if any(secreto is not None for secreto in secretos):
                msg = "en production los secretos de Wompi no pueden venir en una variable"
                raise ValueError(msg)
            configurado = self.wompi_public_key is not None
            if configurado != all(parametro is not None for parametro in parametros) or (
                not configurado and any(parametro is not None for parametro in parametros)
            ):
                msg = (
                    "Wompi en production exige la llave pública y los tres parámetros de "
                    "Parameter Store, o ninguno"
                )
                raise ValueError(msg)
        elif any(parametro is not None for parametro in parametros):
            msg = "los secretos de Wompi solo se leen de Parameter Store con environment production"
            raise ValueError(msg)
        return self

    @property
    def google_callback_url(self) -> str:
        """URI exacta que se registra en Google Cloud."""
        return f"{self.public_url}/api/v1/auth/google/callback"


class MigrationSettings(DatabaseSettings):
    """Conexión de las migraciones: el usuario dueño del esquema, nunca el de la API."""

    model_config = SettingsConfigDict(env_prefix="ALETHEIA_MIGRATION_")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Devuelve la configuración validada; se construye una sola vez por proceso."""
    settings = Settings()
    if settings.environment != "production":
        return settings
    # Import local: boto3 solo se carga cuando de verdad se va a AWS, es decir, en producción.
    from app.core.secrets import with_production_secrets

    return with_production_secrets(settings)
