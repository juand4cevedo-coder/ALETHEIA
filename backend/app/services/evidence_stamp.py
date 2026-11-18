"""Sello de tiempo de una evidencia, fuera de transacciones de base de datos (EVT-tsa_stamp,
HU-020, ADR-038).

Pide el sello sin ninguna sesión abierta, igual que export_build con KMS y S3: una autoridad de
sellado puede tardar hasta ESPERA_SEGUNDOS por intento, y mantener la transacción abierta ese
tiempo retendría el candado del caso.
"""

import datetime
import uuid
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.stamping import SelloInvalidoError, pedir_sello_de_tiempo
from app.db.tenancy import TenantContext, set_tenant
from app.models import Case, CustodyEvent, Evidence
from app.services.custody_chain import GENESIS_HASH
from app.services.jobs import PermanentJobError


@dataclass(frozen=True, slots=True)
class _Pendiente:
    sha256: bytes


def _pendiente(
    session: Session, evidence_id: uuid.UUID, case_id: uuid.UUID, organization_id: uuid.UUID
) -> _Pendiente | None:
    set_tenant(session, TenantContext(organization_id=organization_id))
    evidence = session.scalar(
        select(Evidence).where(
            Evidence.id == evidence_id,
            Evidence.case_id == case_id,
            Evidence.organization_id == organization_id,
        )
    )
    if evidence is None:
        raise PermanentJobError("La evidencia ya no existe.")
    # La tarea se entrega al menos una vez: si ya se selló o ya se marcó fallida, no se repite.
    if evidence.tsa_status != "pending":
        return None
    return _Pendiente(sha256=evidence.sha256)


def _append_event(
    session: Session,
    case_id: uuid.UUID,
    organization_id: uuid.UUID,
    evidence_id: uuid.UUID,
    action: str,
    details: dict[str, object],
    now: datetime.datetime,
) -> None:
    """Mismo bloqueo y cálculo del evento anterior que evidence_upload._record."""
    case = session.scalar(
        select(Case)
        .where(Case.id == case_id, Case.organization_id == organization_id)
        .with_for_update(read=True)
    )
    if case is None:
        raise PermanentJobError("El caso ya no existe.")
    previous = (
        session.scalar(
            select(CustodyEvent.event_hash).where(
                CustodyEvent.case_id == case_id, CustodyEvent.seq == case.custody_seq
            )
        )
        if case.custody_seq
        else GENESIS_HASH
    )
    if previous is None:
        raise PermanentJobError("El caso no tiene un último evento de custodia.")
    # cases.custody_seq lo actualiza el disparador de la base al insertar el evento (migración
    # 0013); la aplicación ni siquiera tiene permiso para escribirlo directamente.
    session.add(
        CustodyEvent(
            organization_id=organization_id,
            case_id=case_id,
            seq=case.custody_seq + 1,
            evidence_id=evidence_id,
            actor_user_id=None,
            action=action,
            details=details,
            occurred_at=now,
            prev_hash=previous,
        )
    )


def stamp(
    open_session: Callable[[], Session],
    evidence_id: uuid.UUID,
    case_id: uuid.UUID,
    organization_id: uuid.UUID,
) -> None:
    with open_session() as session, session.begin():
        pendiente = _pendiente(session, evidence_id, case_id, organization_id)
    if pendiente is None:
        return
    now = datetime.datetime.now(datetime.UTC)
    try:
        sello = pedir_sello_de_tiempo(pendiente.sha256)
    except SelloInvalidoError as exc:
        with open_session() as session, session.begin():
            set_tenant(session, TenantContext(organization_id=organization_id))
            evidence = session.scalar(
                select(Evidence).where(
                    Evidence.id == evidence_id, Evidence.organization_id == organization_id
                )
            )
            if evidence is not None:
                evidence.tsa_status = "failed"
                _append_event(
                    session,
                    case_id,
                    organization_id,
                    evidence_id,
                    "evidence_stamp_failed",
                    {"reason": "no_verifica"},
                    now,
                )
        raise PermanentJobError(str(exc)) from exc
    with open_session() as session, session.begin():
        set_tenant(session, TenantContext(organization_id=organization_id))
        evidence = session.scalar(
            select(Evidence).where(
                Evidence.id == evidence_id, Evidence.organization_id == organization_id
            )
        )
        if evidence is None or evidence.tsa_status != "pending":
            return
        evidence.tsa_status = "stamped"
        evidence.tsa_token = sello.token
        evidence.tsa_time = sello.hora
        _append_event(
            session,
            case_id,
            organization_id,
            evidence_id,
            "evidence_stamped",
            {"tsa_time": sello.hora.strftime("%Y-%m-%dT%H:%M:%S.%fZ")},
            now,
        )
