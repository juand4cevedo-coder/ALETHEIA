"""La solicitud de paquetes respeta membresía, rol y cadena de custodia."""

import datetime
import uuid

from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_principal_allowing_outdated_legal
from app.core.config import Settings
from app.core.legal import LEGAL_VERSION
from app.models import CaseMember, CustodyEvent, Export, Job, Membership, User
from app.services.sessions import Principal
from tests.conftest import ZERO_HASH, NuevoCliente, create_tenant


def _principal(user_id: uuid.UUID, organization_id: uuid.UUID, role: str) -> Principal:
    return Principal(
        user_id=user_id,
        session_id=uuid.uuid7(),
        organization_id=organization_id,
        role=role,
        legal_version=LEGAL_VERSION,
    )


def test_solicitud_encola_y_asistente_no_puede_exportar(
    db: Session, settings: Settings, app: FastAPI, dispositivo: NuevoCliente
) -> None:
    tenant = create_tenant(db, "Solicitud")
    db.add(
        CaseMember(
            case_id=tenant.case_id,
            user_id=tenant.user_id,
            organization_id=tenant.organization_id,
            added_by=tenant.user_id,
        )
    )
    db.add(
        CustodyEvent(
            organization_id=tenant.organization_id,
            case_id=tenant.case_id,
            seq=1,
            actor_user_id=tenant.user_id,
            action="case_created",
            details={"test": True},
            occurred_at=datetime.datetime.now(datetime.UTC),
            prev_hash=ZERO_HASH,
        )
    )
    db.commit()
    app.dependency_overrides[get_principal_allowing_outdated_legal] = lambda: _principal(
        tenant.user_id, tenant.organization_id, "owner"
    )
    client = dispositivo()
    route = f"/api/v1/cases/{tenant.case_id}/exports"
    response = client.post(route)
    assert response.status_code == 202
    assert response.headers["Cache-Control"] == "no-store"
    export_id = uuid.UUID(response.json()["id"])
    assert response.json()["status"] == "queued"
    assert client.get(f"{route}/{export_id}").json()["download_url"] is None
    events = db.scalars(
        select(CustodyEvent)
        .where(CustodyEvent.case_id == tenant.case_id)
        .order_by(CustodyEvent.seq)
    ).all()
    assert [event.action for event in events] == ["case_created", "export_requested"]
    assert db.get(Export, export_id) is not None
    job = db.scalar(select(Job).where(Job.idempotency_key == f"export_build:{export_id}"))
    assert job is not None
    assert job.kind == "export_build"

    db.commit()
    assistant_id = uuid.uuid7()
    db.add(
        User(
            id=assistant_id,
            email=f"{assistant_id}@example.com",
            full_name="Asistente",
            terms_version=LEGAL_VERSION,
            privacy_version=LEGAL_VERSION,
            consented_at=datetime.datetime.now(datetime.UTC),
        )
    )
    db.flush()
    db.add(
        Membership(organization_id=tenant.organization_id, user_id=assistant_id, role="assistant")
    )
    db.add(
        CaseMember(
            case_id=tenant.case_id,
            user_id=assistant_id,
            organization_id=tenant.organization_id,
            added_by=tenant.user_id,
        )
    )
    db.commit()
    app.dependency_overrides[get_principal_allowing_outdated_legal] = lambda: _principal(
        assistant_id, tenant.organization_id, "assistant"
    )
    assert client.post(route).status_code == 403
    assert client.get(f"{route}/{export_id}").status_code == 403


def test_el_historial_lista_los_paquetes_del_caso_con_su_estado_y_quien_los_pidio(
    db: Session, settings: Settings, app: FastAPI, dispositivo: NuevoCliente
) -> None:
    tenant = create_tenant(db, "Historial")
    db.add(
        CaseMember(
            case_id=tenant.case_id,
            user_id=tenant.user_id,
            organization_id=tenant.organization_id,
            added_by=tenant.user_id,
        )
    )
    db.add(
        CustodyEvent(
            organization_id=tenant.organization_id,
            case_id=tenant.case_id,
            seq=1,
            actor_user_id=tenant.user_id,
            action="case_created",
            details={},
            occurred_at=datetime.datetime.now(datetime.UTC),
            prev_hash=ZERO_HASH,
        )
    )
    now = datetime.datetime.now(datetime.UTC)
    expired_id, ready_id, queued_id = uuid.uuid7(), uuid.uuid7(), uuid.uuid7()
    common = {
        "organization_id": tenant.organization_id,
        "case_id": tenant.case_id,
        "requested_by": tenant.user_id,
    }
    db.add(
        Export(
            id=expired_id,
            status="ready",
            manifest_sha256=b"a" * 32,
            storage_key=f"exports/{expired_id}.zip",
            expires_at=now - datetime.timedelta(hours=1),
            **common,
        )
    )
    db.add(
        Export(
            id=ready_id,
            status="ready",
            manifest_sha256=b"b" * 32,
            storage_key=f"exports/{ready_id}.zip",
            expires_at=now + datetime.timedelta(hours=20),
            **common,
        )
    )
    db.add(Export(id=queued_id, status="queued", **common))
    db.commit()
    app.dependency_overrides[get_principal_allowing_outdated_legal] = lambda: _principal(
        tenant.user_id, tenant.organization_id, "owner"
    )
    client = dispositivo()

    response = client.get(f"/api/v1/cases/{tenant.case_id}/exports")

    assert response.status_code == 200, response.text
    assert response.headers["Cache-Control"] == "no-store"
    items = response.json()["items"]
    assert [item["id"] for item in items] == [str(queued_id), str(ready_id), str(expired_id)]
    assert [item["status"] for item in items] == ["queued", "ready", "expired"]
    assert items[0]["download_url"] is None
    assert items[1]["download_url"] is not None
    assert items[2]["download_url"] is None  # vencido: ya no hay enlace
    assert items[1]["manifest_sha256"] == (b"b" * 32).hex()
    assert items[0]["manifest_sha256"] is None
    assert all(item["requested_by_name"] == "Propietario Historial" for item in items)

    # El asistente, con su rol de verdad en la base, no ve el historial de paquetes.
    assistant_id = uuid.uuid7()
    db.add(
        User(
            id=assistant_id,
            email=f"{assistant_id}@example.com",
            full_name="Asistente",
            terms_version=LEGAL_VERSION,
            privacy_version=LEGAL_VERSION,
            consented_at=datetime.datetime.now(datetime.UTC),
        )
    )
    db.flush()
    db.add(
        Membership(organization_id=tenant.organization_id, user_id=assistant_id, role="assistant")
    )
    db.add(
        CaseMember(
            case_id=tenant.case_id,
            user_id=assistant_id,
            organization_id=tenant.organization_id,
            added_by=tenant.user_id,
        )
    )
    db.commit()
    app.dependency_overrides[get_principal_allowing_outdated_legal] = lambda: _principal(
        assistant_id, tenant.organization_id, "assistant"
    )
    assert client.get(f"/api/v1/cases/{tenant.case_id}/exports").status_code == 403
