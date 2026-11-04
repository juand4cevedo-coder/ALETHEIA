"""Configuración del backend, leída de variables de entorno con prefijo ALETHEIA_."""

from functools import lru_cache
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


class DatabaseSettings(BaseSettings):
    """Reglas comunes a toda configuración que lleva una URL de PostgreSQL."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
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

    @property
    def public_url(self) -> str:
        """Dirección pública del sitio, sin barra final, para armar los enlaces de los correos."""
        if self.environment == "production":
            return PRODUCTION_URL
        return self.dev_public_url.rstrip("/")

    @field_validator("token_signing_key")
    @classmethod
    def _long_signing_key(cls, value: Secret[str] | None) -> Secret[str] | None:
        # Una clave corta se puede adivinar probando: con 32 caracteres aleatorios ya no.
        if value is not None and len(value.get_secret_value()) < MIN_SIGNING_KEY_LENGTH:
            msg = f"debe tener al menos {MIN_SIGNING_KEY_LENGTH} caracteres"
            raise ValueError(msg)
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
