"""Resumen, directorio y operación: solo para la plataforma y sin datos de los expedientes."""

import datetime
import uuid

from fastapi import FastAPI
from sqlalchemy.orm import Session

from app.api.deps import get_principal, get_session
from app.models import Job, SupportTicket
from tests.conftest import NuevoCliente
from tests.test_platform_modules import _principal, _user


def test_los_indicadores_rechazan_cuentas_ordinarias(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    user = _user(owner_db, "ordinary@example.com")
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(user)
    client = dispositivo()
    for path in ("overview", "organizations", "operations"):
        assert client.get(f"/api/v1/platform/{path}").status_code == 403


def test_el_resumen_cuenta_solicitudes_vencidas_y_cuentas_nuevas(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "owner@example.com", platform_admin=True)
    client_user = _user(owner_db, "client@example.com")
    today = datetime.datetime.now(datetime.UTC)
    owner_db.add_all(
        [
            SupportTicket(
                user_id=client_user.id,
                filing_number="PQR-2026-90001",
                category="data_claim",
                due_on=(today - datetime.timedelta(days=3)).date(),
                subject="Corregir mi nombre",
                message="Mi nombre quedó mal escrito en la cuenta.",
            ),
            Job(
                kind="email_send",
                payload={},
                idempotency_key=f"prueba-{uuid.uuid4()}",
                status="dead",
                attempts=5,
                last_error="SMTPRecipientsRefused: persona@example.com rechazado",
            ),
        ]
    )
    owner_db.flush()
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(admin)
    client = dispositivo()

    overview = client.get("/api/v1/platform/overview")
    assert overview.status_code == 200
    body = overview.json()
    assert body["tickets_overdue"] >= 1
    assert body["jobs_failed"] >= 1
    assert any(item["email"] == client_user.email for item in body["recent_accounts"])
    assert len(body["signups"]) == 30

    operations = client.get("/api/v1/platform/operations").json()
    failed = next(job for job in operations["failed"] if job["kind"] == "email_send")
    # Solo el tipo de error: el mensaje traía un correo.
    assert failed["error"] == "SMTPRecipientsRefused"

    directory = client.get("/api/v1/platform/organizations", params={"search": "x"})
    assert directory.status_code == 200
    assert "total" in directory.json()


def _ticket(
    user_id: uuid.UUID, number: str, category: str, closed_days_ago: int | None
) -> SupportTicket:
    closed_at = (
        None
        if closed_days_ago is None
        else datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=closed_days_ago)
    )
    return SupportTicket(
        user_id=user_id,
        filing_number=number,
        category=category,
        status="open" if closed_at is None else "closed",
        closed_at=closed_at,
        due_on=datetime.date(2026, 12, 16),
        subject="Una solicitud",
        message="El detalle de la solicitud de prueba.",
    )


def test_solo_se_eliminan_las_solicitudes_que_ya_no_hay_que_conservar(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "owner@example.com", platform_admin=True)
    client_user = _user(owner_db, "client@example.com")
    open_ticket = _ticket(client_user.id, "PQR-2026-70001", "support", None)
    support_done = _ticket(client_user.id, "PQR-2026-70002", "support", 1)
    claim_recent = _ticket(client_user.id, "PQR-2026-70003", "data_claim", 30)
    claim_old = _ticket(client_user.id, "PQR-2023-70004", "data_claim", 365 * 3 + 5)
    owner_db.add_all([open_ticket, support_done, claim_recent, claim_old])
    owner_db.flush()
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(admin)
    client = dispositivo()

    def delete(ticket: SupportTicket) -> int:
        return client.delete(f"/api/v1/platform/support/tickets/{ticket.id}").status_code

    assert delete(open_ticket) == 409
    assert delete(claim_recent) == 409
    assert delete(support_done) == 204
    assert delete(claim_old) == 204
    assert owner_db.get(SupportTicket, support_done.id) is None
    assert owner_db.get(SupportTicket, claim_recent.id) is not None


def test_una_tarea_fallida_vuelve_a_la_cola(
    app: FastAPI, owner_db: Session, dispositivo: NuevoCliente
) -> None:
    admin = _user(owner_db, "owner@example.com", platform_admin=True)
    job = Job(
        kind="email_send",
        payload={},
        idempotency_key=f"prueba-{uuid.uuid4()}",
        status="dead",
        attempts=5,
        last_error="TimeoutError: sin respuesta",
    )
    owner_db.add(job)
    owner_db.flush()
    app.dependency_overrides[get_session] = lambda: owner_db
    app.dependency_overrides[get_principal] = lambda: _principal(admin)
    client = dispositivo()
    assert client.post(f"/api/v1/platform/jobs/{job.id}/retry").status_code == 204
    owner_db.refresh(job)
    assert (job.status, job.attempts, job.last_error) == ("queued", 0, None)
    assert client.post(f"/api/v1/platform/jobs/{job.id}/retry").status_code == 409
