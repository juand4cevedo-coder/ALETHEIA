"""Prueba de acceso cruzado: una organización nunca ve ni toca los datos de otra (SEC-001)."""

import uuid

from psycopg.errors import InsufficientPrivilege, NoDataFound
from sqlalchemy import Engine, func, select, text, update
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import Case, Membership, Organization
from tests.conftest import Tenant, create_tenant, rejected


def _two_tenants(db: Session) -> tuple[Tenant, Tenant]:
    return create_tenant(db, "Firma A"), create_tenant(db, "Firma B")


def test_sin_contexto_no_se_ve_ninguna_fila(db: Session) -> None:
    _two_tenants(db)
    set_tenant(db, TenantContext())

    assert db.scalar(select(func.count()).select_from(Case)) == 0
    assert db.scalar(select(func.count()).select_from(Organization)) == 0
    assert db.scalar(select(func.count()).select_from(Membership)) == 0


def test_una_organizacion_solo_ve_sus_propios_datos(db: Session) -> None:
    a, b = _two_tenants(db)
    set_tenant(db, a.context)

    assert db.scalars(select(Case.id)).all() == [a.case_id]
    assert db.scalars(select(Organization.id)).all() == [a.organization_id]
    assert db.get(Case, b.case_id) is None


def test_una_organizacion_no_modifica_los_datos_de_otra(db: Session) -> None:
    a, b = _two_tenants(db)
    set_tenant(db, a.context)

    result = db.execute(
        update(Case).where(Case.id == b.case_id).values(status="closed", closed_at=func.now())
    )

    assert result.rowcount == 0  # type: ignore[attr-defined]
    set_tenant(db, b.context)
    assert db.scalar(select(Case.status).where(Case.id == b.case_id)) == "open"


def test_una_organizacion_no_escribe_en_otra(db: Session) -> None:
    a, b = _two_tenants(db)
    set_tenant(db, a.context)

    with rejected(db, InsufficientPrivilege):
        db.add(
            Case(
                organization_id=b.organization_id,
                title="Caso intruso",
                wrapped_key=b"llave",
                key_version="prueba",
                created_by=a.user_id,
            )
        )


def test_cada_persona_encuentra_su_membresia_sin_conocer_su_organizacion(db: Session) -> None:
    _, b = _two_tenants(db)
    # Así ingresa una persona: se sabe quién es, pero no aún su organización.
    set_tenant(db, TenantContext(user_id=b.user_id))

    assert db.scalars(select(Membership.organization_id)).all() == [b.organization_id]


def test_el_contexto_no_pasa_a_la_siguiente_transaccion(app_engine: Engine) -> None:
    with Session(app_engine) as session:
        set_tenant(session, TenantContext(organization_id=uuid.uuid7()))
        assert session.scalar(text("SELECT app_organization_id()")) is not None
        session.commit()

    with app_engine.connect() as connection:
        assert connection.scalar(text("SELECT app_organization_id()")) is None


def test_purge_case_no_elimina_casos_de_otra_organizacion(db: Session) -> None:
    a, b = _two_tenants(db)
    set_tenant(db, b.context)
    db.execute(
        update(Case)
        .where(Case.id == b.case_id)
        .values(status="deleting", closed_at=func.now(), wrapped_key=None)
    )
    set_tenant(db, a.context)

    with rejected(db, NoDataFound):
        db.execute(
            text("SELECT purge_case(:case_id, :record_id, :user_id, '7 days')"),
            {"case_id": b.case_id, "record_id": uuid.uuid7(), "user_id": a.user_id},
        )
    set_tenant(db, b.context)
    assert db.get(Case, b.case_id) is not None
