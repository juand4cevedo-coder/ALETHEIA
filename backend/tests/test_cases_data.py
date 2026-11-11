"""Pruebas de los datos procesales del caso: radicado, despacho y especialidad."""

import os
import uuid

import pytest
from psycopg.errors import CheckViolation, UniqueViolation
from sqlalchemy.orm import Session

from app.models import Case
from tests.conftest import Tenant, create_tenant, rejected


def _caso(tenant: Tenant, **datos: object) -> Case:
    base: dict[str, object] = dict(
        id=uuid.uuid7(),
        organization_id=tenant.organization_id,
        title="Caso de prueba",
        wrapped_key=os.urandom(40),
        key_version="prueba",
        created_by=tenant.user_id,
    )
    return Case(**(base | datos))


@pytest.mark.parametrize("radicado", ["1" * 22, "1" * 24, "1100131050032026001430A"])
def test_el_radicado_solo_acepta_23_digitos(owner_db: Session, radicado: str) -> None:
    tenant = create_tenant(owner_db, "Radicado")

    with rejected(owner_db, CheckViolation):
        owner_db.add(_caso(tenant, filing_number=radicado))

    owner_db.add(_caso(tenant, filing_number="1" * 23))
    owner_db.flush()


def test_el_mismo_radicado_no_se_repite_en_una_organizacion(owner_db: Session) -> None:
    uno = create_tenant(owner_db, "Uno")
    owner_db.add(_caso(uno, filing_number="1" * 23))
    owner_db.flush()

    with rejected(owner_db, UniqueViolation):
        owner_db.add(_caso(uno, filing_number="1" * 23))

    otra = create_tenant(owner_db, "Otra")
    owner_db.add(_caso(otra, filing_number="1" * 23))
    owner_db.add(_caso(uno))
    owner_db.add(_caso(uno))
    owner_db.flush()


def test_la_especialidad_es_de_la_lista(owner_db: Session) -> None:
    tenant = create_tenant(owner_db, "Especialidad")

    with rejected(owner_db, CheckViolation):
        owner_db.add(_caso(tenant, practice_area="tax"))

    owner_db.add(_caso(tenant, practice_area="labor"))
    owner_db.flush()


def test_el_despacho_tiene_entre_1_y_160_caracteres(owner_db: Session) -> None:
    tenant = create_tenant(owner_db, "Despacho")

    with rejected(owner_db, CheckViolation):
        owner_db.add(_caso(tenant, court=""))
    with rejected(owner_db, CheckViolation):
        owner_db.add(_caso(tenant, court="a" * 161))

    owner_db.add(_caso(tenant, court="a"))
    owner_db.add(_caso(tenant, court="a" * 160))
    owner_db.flush()
