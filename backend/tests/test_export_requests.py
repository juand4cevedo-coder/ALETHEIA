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
