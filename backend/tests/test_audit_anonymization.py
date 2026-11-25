"""La IP y el navegador del registro de seguridad se borran a los 90 días (RN-027)."""

import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog
from app.services.audit import anonymize_expired_network


def test_solo_se_borran_la_ip_y_el_navegador_de_los_eventos_vencidos(owner_db: Session) -> None:
    now = datetime.datetime.now(datetime.UTC)
    old = AuditLog(
        action="login_failed",
        ip="203.0.113.7",
        user_agent="Navegador de prueba",
        created_at=now - datetime.timedelta(days=91),
    )
    recent = AuditLog(
        action="login_failed",
        ip="203.0.113.8",
        user_agent="Navegador de prueba",
        created_at=now - datetime.timedelta(days=89),
    )
    owner_db.add_all([old, recent])
    owner_db.flush()

    assert anonymize_expired_network(owner_db) >= 1
    owner_db.expire_all()

    rows = dict(
        owner_db.execute(
            select(AuditLog.id, AuditLog.ip).where(AuditLog.id.in_((old.id, recent.id)))
        ).all()
    )
    assert rows[old.id] is None
    assert rows[recent.id] is not None
    kept = owner_db.get(AuditLog, old.id)
    assert kept is not None
    assert kept.action == "login_failed"
    assert kept.user_agent is None
