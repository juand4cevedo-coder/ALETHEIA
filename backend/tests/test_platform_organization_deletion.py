"""La plataforma cierra un despacho completo sin tocar los casos que se conservan (ADR-061)."""

import uuid

from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, Membership, Organization, Subscription, User
from tests.conftest import NuevoCliente
from tests.organizations import crear_miembro, crear_oficina
from tests.test_platform_account_deletion import _as_platform
from tests.test_platform_api import _user


def _delete(client, organization_id: uuid.UUID, confirmation: str):  # type: ignore[no-untyped-def]
    return client.post(
        f"/api/v1/platform/organizations/{organization_id}/deletion",
        json={"confirmation": confirmation},
    )


def test_cierra_el_despacho_y_las_cuentas_de_todo_su_equipo(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "plataforma@example.com", platform_admin=True)
    oficina = crear_oficina(owner_db, nombre="Cierre")
    abogada = crear_miembro(owner_db, oficina, "abogada.cierre@example.com", "lawyer")
    _as_platform(app, owner_db, admin)
    owner_db.commit()
    client = dispositivo()

    response = _delete(client, oficina.organization_id, "  cierre abogados ")

    assert response.status_code == 204, response.text
    owner_db.expire_all()
    assert owner_db.get_one(Organization, oficina.organization_id).status == "closed"
    subscription = owner_db.scalar(
        select(Subscription).where(Subscription.organization_id == oficina.organization_id)
    )
    assert subscription is not None
    assert subscription.status == "canceled"
    for person in (oficina.owner, abogada):
        after = owner_db.get_one(User, person.id)
        assert after.status == "closed"
        assert after.email == f"closed-{person.id}@deleted.invalid"
    assert (
        owner_db.scalar(
            select(Membership).where(Membership.organization_id == oficina.organization_id)
        )
        is None
    )
    audit = owner_db.scalars(
        select(AuditLog).where(AuditLog.action == "organization_deleted_by_platform")
    ).all()
    assert [row.target_id for row in audit] == [oficina.organization_id]
    assert audit[0].details == {"accounts_closed": "2", "case_records": "preserved"}
    # Ya cerrado, no se puede cerrar de nuevo.
    assert _delete(client, oficina.organization_id, "Cierre Abogados").status_code == 404


def test_pide_el_nombre_exacto_del_despacho(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "plataforma@example.com", platform_admin=True)
    oficina = crear_oficina(owner_db, nombre="Firme")
    _as_platform(app, owner_db, admin)
    owner_db.commit()
    client = dispositivo()

    assert _delete(client, oficina.organization_id, "Otro despacho").status_code == 422
    assert _delete(client, uuid.uuid7(), "Firme Abogados").status_code == 404
    owner_db.expire_all()
    assert owner_db.get_one(Organization, oficina.organization_id).status == "active"


def test_solo_la_plataforma_puede_cerrar_un_despacho(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    oficina = crear_oficina(owner_db, nombre="Ajena")
    intruso = _user(owner_db, "intruso@example.com")
    _as_platform(app, owner_db, intruso)
    owner_db.commit()
    client = dispositivo()

    response = _delete(client, oficina.organization_id, "Ajena Abogados")

    assert response.status_code == 403
    owner_db.expire_all()
    assert owner_db.get_one(Organization, oficina.organization_id).status == "active"


def test_la_lista_de_despachos_dice_si_es_independiente_o_firma(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "plataforma@example.com", platform_admin=True)
    firma = crear_oficina(owner_db, nombre="Firma", kind="firm")
    independiente = crear_oficina(owner_db, nombre="Sola")
    owner_db.get_one(Organization, independiente.organization_id).kind = "individual"
    _as_platform(app, owner_db, admin)
    owner_db.commit()
    client = dispositivo()

    todas = client.get("/api/v1/platform/organizations").json()["items"]
    solo_firmas = client.get("/api/v1/platform/organizations?kind=firm").json()["items"]

    tipos = {row["id"]: row["kind"] for row in todas}
    assert tipos[str(firma.organization_id)] == "firm"
    assert tipos[str(independiente.organization_id)] == "individual"
    assert str(independiente.organization_id) not in {row["id"] for row in solo_firmas}
