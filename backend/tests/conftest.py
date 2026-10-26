"""Piezas compartidas por las pruebas del backend."""

import datetime
import hashlib
import os
import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, create_engine, make_url, pool
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import Case, Evidence, Membership, Organization, User

TEST_DATABASE_URL_VARIABLE = "ALETHEIA_TEST_DATABASE_URL"
TEST_MIGRATION_DATABASE_URL_VARIABLE = "ALETHEIA_TEST_MIGRATION_DATABASE_URL"
_BACKEND_DIR: Final = Path(__file__).resolve().parents[1]


def _build_settings(database_url: str) -> Settings:
    # Cada campo se da explícito: los valores directos tienen prioridad sobre el entorno y
    # sobre backend/.env, así que la prueba no depende de la configuración del equipo.
    return Settings.model_validate(
        {"environment": "test", "log_level": "INFO", "database_url": database_url}
    )


def _required_url(variable: str) -> str:
    url = os.environ.get(variable)
    if not url:
        pytest.fail(f"Falta la variable {variable} con la URL de la base de pruebas.")
    # Se acepta postgresql:// o postgresql+psycopg://; SQLAlchemy necesita el controlador.
    return make_url(url).set(drivername="postgresql+psycopg").render_as_string(hide_password=False)


@pytest.fixture
def make_settings() -> Callable[[str], Settings]:
    """Construye una configuración de prueba con la URL de base de datos indicada."""
    return _build_settings


@pytest.fixture
def settings() -> Settings:
    """Configuración con una URL que nunca se usa para conectar."""
    return _build_settings("postgresql+psycopg://aletheia:clave-de-prueba@localhost:5432/aletheia")


@pytest.fixture
def test_database_url() -> str:
    """URL de la base de pruebas con el usuario de la aplicación."""
    return _required_url(TEST_DATABASE_URL_VARIABLE)


# --- Base de datos de pruebas -----------------------------------------------------------


def alembic_config(connection: Connection) -> Config:
    """Configuración de Alembic que usa la conexión de la prueba y no toca los registros."""
    config = Config(toml_file=_BACKEND_DIR / "pyproject.toml")
    config.attributes["connection"] = connection
    config.attributes["configure_logging"] = False
    return config


def run_alembic(engine: Engine, action: Callable[[Config, str], None], target: str) -> None:
    """Ejecuta un comando de Alembic en su propia transacción, que se confirma al final."""
    with engine.begin() as connection:
        action(alembic_config(connection), target)


@pytest.fixture(scope="session")
def owner_engine() -> Iterator[Engine]:
    """Conexiones con el dueño del esquema, el mismo usuario de las migraciones."""
    engine = create_engine(
        _required_url(TEST_MIGRATION_DATABASE_URL_VARIABLE), poolclass=pool.NullPool
    )
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def app_engine() -> Iterator[Engine]:
    """Conexiones con el usuario de la aplicación, sujeto a permisos y a Row-Level Security."""
    engine = create_engine(_required_url(TEST_DATABASE_URL_VARIABLE), poolclass=pool.NullPool)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def migrated_database(owner_engine: Engine) -> None:
    """Deja la base de pruebas con el esquema completo y vacío, una vez por ejecución."""
    run_alembic(owner_engine, command.downgrade, "base")
    run_alembic(owner_engine, command.upgrade, "head")


@contextmanager
def _rolled_back_session(engine: Engine) -> Iterator[Session]:
    # Todo ocurre dentro de una transacción que se deshace al final: ninguna prueba deja
    # datos, ni siquiera constancias o eventos de custodia, que no se pueden borrar.
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def db(app_engine: Engine, migrated_database: None) -> Iterator[Session]:
    """Sesión de la aplicación; sus cambios se deshacen al terminar la prueba."""
    with _rolled_back_session(app_engine) as session:
        yield session


@pytest.fixture
def owner_db(owner_engine: Engine, migrated_database: None) -> Iterator[Session]:
    """Sesión del dueño del esquema; sus cambios se deshacen al terminar la prueba."""
    with _rolled_back_session(owner_engine) as session:
        yield session


@contextmanager
def rejected(session: Session, error: type[psycopg.Error]) -> Iterator[None]:
    """Comprueba que PostgreSQL rechaza lo que ocurre dentro del bloque con el error dado.

    El bloque corre en un punto de guardado: tras el error, la sesión sigue usable.
    """
    savepoint = session.begin_nested()
    try:
        yield
        session.flush()
    except DBAPIError as exc:
        savepoint.rollback()
        if not isinstance(exc.orig, error):
            pytest.fail(f"Se esperaba {error.__name__} y llegó {type(exc.orig).__name__}")
    else:
        savepoint.rollback()
        pytest.fail(f"PostgreSQL debía rechazar la operación con {error.__name__}")


# --- Datos de prueba --------------------------------------------------------------------

ZERO_HASH: Final = bytes(32)


@dataclass(frozen=True, slots=True)
class Tenant:
    """Una organización de prueba con su propietario y un caso abierto."""

    organization_id: uuid.UUID
    user_id: uuid.UUID
    case_id: uuid.UUID

    @property
    def context(self) -> TenantContext:
        return TenantContext(organization_id=self.organization_id, user_id=self.user_id)


def create_tenant(session: Session, name: str) -> Tenant:
    """Crea una organización con su propietario y un caso, y deja su contexto fijado."""
    tenant = Tenant(organization_id=uuid.uuid7(), user_id=uuid.uuid7(), case_id=uuid.uuid7())
    session.add(
        User(
            id=tenant.user_id,
            email=f"{tenant.user_id}@example.com",
            full_name=f"Propietario {name}",
            terms_version="1.0",
            privacy_version="1.0",
            consented_at=datetime.datetime.now(datetime.UTC),
        )
    )
    session.flush()
    set_tenant(session, tenant.context)
    session.add(Organization(id=tenant.organization_id, name=name))
    session.flush()
    session.add(
        Membership(organization_id=tenant.organization_id, user_id=tenant.user_id, role="owner")
    )
    session.add(
        Case(
            id=tenant.case_id,
            organization_id=tenant.organization_id,
            title=f"Caso de {name}",
            wrapped_key=os.urandom(40),
            key_version="prueba",
            created_by=tenant.user_id,
        )
    )
    session.flush()
    return tenant


def add_evidence(session: Session, tenant: Tenant, content: bytes) -> uuid.UUID:
    """Registra una evidencia del caso del tenant y devuelve su identificador."""
    evidence_id = uuid.uuid7()
    session.add(
        Evidence(
            id=evidence_id,
            organization_id=tenant.organization_id,
            case_id=tenant.case_id,
            sha256=hashlib.sha256(content).digest(),
            size_bytes=len(content),
            original_filename="conversacion.txt",
            declared_type="chat",
            detected_type="text/plain",
            declared_origin="Exportada desde WhatsApp",
            storage_key=f"cases/{tenant.case_id}/{evidence_id}",
            uploaded_by=tenant.user_id,
        )
    )
    session.flush()
    return evidence_id
