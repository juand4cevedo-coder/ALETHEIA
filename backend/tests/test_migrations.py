"""Pruebas de las migraciones y de los permisos del usuario de la aplicación."""

from alembic import command
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from psycopg.errors import InsufficientPrivilege
from sqlalchemy import Engine, inspect, text
from sqlalchemy.orm import Session

from tests.conftest import alembic_config, rejected, run_alembic


def test_la_cadena_de_migraciones_tiene_una_sola_cabeza(owner_engine: Engine) -> None:
    # Dos cabezas significan dos ramas de migraciones sin unir.
    with owner_engine.connect() as connection:
        heads = ScriptDirectory.from_config(alembic_config(connection)).get_heads()
    assert len(heads) == 1


def test_las_migraciones_bajan_y_vuelven_a_subir(
    owner_engine: Engine, migrated_database: None
) -> None:
    run_alembic(owner_engine, command.downgrade, "base")
    with owner_engine.connect() as connection:
        assert inspect(connection).get_table_names() == ["alembic_version"]

    run_alembic(owner_engine, command.upgrade, "head")
    with owner_engine.connect() as connection:
        script = ScriptDirectory.from_config(alembic_config(connection))
        current = MigrationContext.configure(connection).get_current_revision()
    assert current == script.get_current_head()


def test_los_modelos_coinciden_con_las_migraciones(
    owner_engine: Engine, migrated_database: None
) -> None:
    # Falla si alguien cambió un modelo sin crear su migración.
    with owner_engine.connect() as connection:
        command.check(alembic_config(connection))


def test_la_aplicacion_no_es_superusuario_ni_salta_las_politicas(db: Session) -> None:
    privileged = db.scalar(
        text("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user")
    )
    assert privileged is False


def test_la_aplicacion_no_puede_cambiar_el_esquema(db: Session) -> None:
    with rejected(db, InsufficientPrivilege):
        db.execute(text("CREATE TABLE intrusa (id integer)"))
    with rejected(db, InsufficientPrivilege):
        db.execute(text("ALTER TABLE cases ADD COLUMN intrusa integer"))
