"""La migración agenda pruebas que ya existen antes de publicar el trabajador."""

import datetime
import uuid

from alembic import command
from sqlalchemy import Engine, text

from tests.conftest import run_alembic


def test_migracion_0018_agenda_una_prueba_existente(
    owner_engine: Engine, migrated_database: None
) -> None:
    del migrated_database
    organization_id = uuid.uuid7()
    deadline = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=14)
    run_alembic(owner_engine, command.downgrade, "0017")
    try:
        with owner_engine.begin() as connection:
            plan_id = connection.scalar(text("SELECT id FROM plans WHERE code = 'trial'"))
            assert plan_id is not None
            connection.execute(
                text("INSERT INTO organizations (id, name) VALUES (:id, :name)"),
                {"id": organization_id, "name": "Despacho anterior a la versión 0.4.6"},
            )
            connection.execute(
                text(
                    "INSERT INTO subscriptions "
                    "(id, organization_id, plan_id, status, billing_cycle, trial_ends_at) "
                    "VALUES (:id, :organization_id, :plan_id, 'trial', 'none', :deadline)"
                ),
                {
                    "id": uuid.uuid7(),
                    "organization_id": organization_id,
                    "plan_id": plan_id,
                    "deadline": deadline,
                },
            )
        run_alembic(owner_engine, command.upgrade, "0018")
        with owner_engine.connect() as connection:
            job = connection.execute(
                text("SELECT payload, run_after FROM jobs WHERE kind = 'subscription_expire'")
            ).one()
            assert job.payload == {"organization_id": str(organization_id)}
            assert job.run_after == deadline
    finally:
        # Deja el mismo esquema y catálogo vacío para las demás pruebas de la suite.
        run_alembic(owner_engine, command.downgrade, "base")
        run_alembic(owner_engine, command.upgrade, "head")
