"""Configuración del backend, leída de variables de entorno con prefijo ALETHEIA_."""

from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, PostgresDsn, Secret, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "test", "production"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR"]

_DRIVER_SCHEME = "postgresql+psycopg"


class _DatabaseSettings(BaseSettings):
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

    @field_validator("database_url")
    @classmethod
    def _require_psycopg_driver(cls, value: Secret[PostgresDsn]) -> Secret[PostgresDsn]:
        # Sin el sufijo +psycopg, SQLAlchemy buscaría psycopg2, que no está instalado.
        if value.get_secret_value().scheme != _DRIVER_SCHEME:
            msg = f"debe usar el esquema {_DRIVER_SCHEME}://"
            raise ValueError(msg)
        return value


class Settings(_DatabaseSettings):
    """Valores que la API necesita para arrancar; los obligatorios no tienen valor por defecto."""

    model_config = SettingsConfigDict(env_prefix="ALETHEIA_")

    environment: Environment = "development"
    log_level: LogLevel = "INFO"

    @model_validator(mode="after")
    def _debug_only_in_development(self) -> Self:
        # El nivel DEBUG puede volcar datos internos: solo se permite en desarrollo.
        if self.log_level == "DEBUG" and self.environment != "development":
            msg = "log_level DEBUG solo se permite con environment development"
            raise ValueError(msg)
        return self


class MigrationSettings(_DatabaseSettings):
    """Conexión de las migraciones: el usuario dueño del esquema, nunca el de la API."""

    model_config = SettingsConfigDict(env_prefix="ALETHEIA_MIGRATION_")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Devuelve la configuración validada; se construye una sola vez por proceso."""
    return Settings()
