"""Portal del cliente: quién invita, qué ve el cliente y qué queda registrado (ADR-054)."""

import datetime
import re
import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.tokens import InvalidPortalLinkError, issue_portal_link, read_portal_link
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, ClientPortalAccess, Job
from app.services.client_portal import INVITE_TEMPLATE, MESSAGE_TEMPLATE
from app.services.client_portal_emails import invite_email, message_email
from tests.conftest import NuevoCliente
from tests.organizations import Oficina, crear_miembro, crear_oficina
from tests.test_case_notes import _session

_CASES = "/api/v1/cases"
_VIEW = "/api/v1/client-portal/view"
_ACCEPT = "/api/v1/client-portal/accept-notice"


def _invites(db: Session) -> list[dict[str, Any]]:
    jobs = db.scalars(select(Job).where(Job.kind == "email_send").order_by(Job.id)).all()
    return [dict(job.payload) for job in jobs if job.payload.get("template") == INVITE_TEMPLATE]


def _token_of_last_invite(db: Session, settings: Settings) -> str:
    email = invite_email(db, _invites(db)[-1], settings)
    assert email is not None
    found = re.search(r"#t=([\w.-]+)", email.text)
    assert found is not None, email.text
    return found.group(1)


def _case(dispositivo: NuevoCliente, db: Session) -> tuple[Oficina, TestClient, str]:
    office = crear_oficina(db)
    lawyer = crear_miembro(db, office, f"abogada-{uuid.uuid4().hex[:6]}@example.com", "lawyer")
    client = _session(dispositivo, db, lawyer)
    case_id = client.post(_CASES, json={"title": "Caso del portal"}).json()["id"]
    return office, client, case_id


def _invite(client: TestClient, case_id: str, email: str = "cliente@example.com") -> dict[str, Any]:
    response = client.post(
        f"{_CASES}/{case_id}/portal/accesses",
        json={"client_name": "María Pérez", "client_email": email},
    )
    assert response.status_code == 201, response.text
    return dict(response.json())


def _actions(db: Session, office: Oficina, action: str) -> int:
    organization_id = office.organization_id
    set_tenant(db, TenantContext(organization_id=organization_id, user_id=office.owner.id))
    return len(
        db.scalars(
            select(AuditLog).where(
                AuditLog.organization_id == organization_id, AuditLog.action == action
            )
        ).all()
    )


def test_el_enlace_firmado_lleva_el_acceso_y_su_version(settings: Settings) -> None:
    access_id, organization_id = uuid.uuid4(), uuid.uuid4()
    soon = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=1)
    token = issue_portal_link(settings.signing_key(), access_id, organization_id, 3, soon)

    claims = read_portal_link(settings.signing_key(), token)

    assert (claims.access_id, claims.organization_id, claims.version) == (
        access_id,
        organization_id,
        3,
    )
    try:
        read_portal_link(settings.signing_key(), token + "x")
    except InvalidPortalLinkError:
        pass
    else:
        raise AssertionError("Un token alterado no debe leerse.")


def test_invitar_envia_el_enlace_y_queda_en_la_auditoria(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, lawyer, case_id = _case(dispositivo, db)

    access = _invite(lawyer, case_id)

    assert access["status"] == "active"
    assert access["notice_accepted_at"] is None
    assert len(_invites(db)) == 1
    email = invite_email(db, _invites(db)[0], settings)
    assert email is not None
    assert email.to == "cliente@example.com"
    assert "Caso del portal" not in email.text
    assert _actions(db, office, "client_portal_invited") == 1
    listed = lawyer.get(f"{_CASES}/{case_id}/portal/accesses").json()["items"]
    assert [item["client_email"] for item in listed] == ["cliente@example.com"]


def test_solo_duenos_y_abogados_del_caso_manejan_el_portal(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office, lawyer, case_id = _case(dispositivo, db)
    assistant = crear_miembro(db, office, "asistente.portal@example.com", "assistant")
    lawyer.post(f"{_CASES}/{case_id}/members", json={"user_id": str(assistant.id)})
    assistant_client = _session(dispositivo, db, assistant)
    stranger = crear_miembro(db, office, "ajena.portal@example.com", "lawyer")
    stranger_client = _session(dispositivo, db, stranger)
    body = {"client_name": "María", "client_email": "cliente@example.com"}

    by_assistant = assistant_client.post(f"{_CASES}/{case_id}/portal/accesses", json=body)
    by_stranger = stranger_client.post(f"{_CASES}/{case_id}/portal/accesses", json=body)
    listed = assistant_client.get(f"{_CASES}/{case_id}/portal/accesses")

    assert by_assistant.status_code == 403
    assert by_stranger.status_code == 404
    assert listed.status_code == 403
    assert _invites(db) == []


def test_invitar_otra_vez_reenvia_y_el_enlace_anterior_deja_de_servir(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    _, lawyer, case_id = _case(dispositivo, db)
    first = _invite(lawyer, case_id)
    old_token = _token_of_last_invite(db, settings)

    second = _invite(lawyer, case_id, "CLIENTE@example.com")
    new_token = _token_of_last_invite(db, settings)
    anonymous = dispositivo()

    assert second["id"] == first["id"]
    assert len(_invites(db)) == 2
    assert anonymous.post(_VIEW, json={"token": old_token}).status_code == 404
    assert anonymous.post(_VIEW, json={"token": new_token}).status_code == 200


def test_el_cliente_no_ve_el_caso_hasta_aceptar_el_aviso(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, lawyer, case_id = _case(dispositivo, db)
    _invite(lawyer, case_id)
    lawyer.post(f"{_CASES}/{case_id}/notes", json={"body": "Estrategia interna"})
    published = lawyer.post(
        f"{_CASES}/{case_id}/portal/updates", json={"body": "  Se radicó la demanda.  "}
    )
    assert published.status_code == 201, published.text
    token = _token_of_last_invite(db, settings)
    anonymous = dispositivo()

    before = anonymous.post(_VIEW, json={"token": token})
    assert before.status_code == 200, before.text
    assert before.headers["Cache-Control"] == "no-store"
    assert before.json()["notice_accepted"] is False
    assert before.json()["case_title"] is None
    assert before.json()["updates"] == []
    assert before.json()["client_name"] == "María Pérez"

    accepted = anonymous.post(_ACCEPT, json={"token": token})
    again = anonymous.post(_ACCEPT, json={"token": token})
    after = anonymous.post(_VIEW, json={"token": token}).json()

    assert accepted.status_code == 204, accepted.text
    assert again.status_code == 204
    assert after["notice_accepted"] is True
    assert after["case_title"] == "Caso del portal"
    assert after["case_status"] == "open"
    assert [item["body"] for item in after["updates"]] == ["Se radicó la demanda."]
    assert "Estrategia interna" not in str(after)
    assert _actions(db, office, "client_portal_notice_accepted") == 1
    assert _actions(db, office, "client_portal_update_published") == 1


def test_revocar_el_acceso_cierra_el_portal_al_instante(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, lawyer, case_id = _case(dispositivo, db)
    access = _invite(lawyer, case_id)
    token = _token_of_last_invite(db, settings)
    anonymous = dispositivo()
    assert anonymous.post(_VIEW, json={"token": token}).status_code == 200

    revoked = lawyer.delete(f"{_CASES}/{case_id}/portal/accesses/{access['id']}")
    repeated = lawyer.delete(f"{_CASES}/{case_id}/portal/accesses/{access['id']}")

    assert revoked.status_code == 204
    assert repeated.status_code == 204
    assert anonymous.post(_VIEW, json={"token": token}).status_code == 404
    assert anonymous.post(_ACCEPT, json={"token": token}).status_code == 404
    assert invite_email(db, _invites(db)[-1], settings) is None
    assert _actions(db, office, "client_portal_revoked") == 1
    status = lawyer.get(f"{_CASES}/{case_id}/portal/accesses").json()["items"][0]["status"]
    assert status == "revoked"


def test_un_enlace_vencido_o_inventado_no_abre_nada(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, lawyer, case_id = _case(dispositivo, db)
    _invite(lawyer, case_id)
    token = _token_of_last_invite(db, settings)
    set_tenant(db, TenantContext(organization_id=office.organization_id))
    db.execute(
        update(ClientPortalAccess).values(
            expires_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=1)
        )
    )
    db.flush()
    anonymous = dispositivo()

    assert anonymous.post(_VIEW, json={"token": token}).status_code == 404
    assert anonymous.post(_VIEW, json={"token": "inventado"}).status_code == 404


def test_un_caso_archivado_no_admite_invitaciones_ni_avisos_nuevos(
    dispositivo: NuevoCliente, db: Session
) -> None:
    _, lawyer, case_id = _case(dispositivo, db)
    closed = lawyer.post(f"{_CASES}/{case_id}/close")
    assert closed.status_code == 200, closed.text

    invite = lawyer.post(
        f"{_CASES}/{case_id}/portal/accesses",
        json={"client_name": "María", "client_email": "cliente@example.com"},
    )
    update_response = lawyer.post(f"{_CASES}/{case_id}/portal/updates", json={"body": "Hola"})

    assert invite.status_code == 409
    assert update_response.status_code == 409


def test_el_portal_se_limita_por_direccion(dispositivo: NuevoCliente) -> None:
    anonymous = dispositivo()
    codes = {anonymous.post(_VIEW, json={"token": "x"}).status_code for _ in range(61)}

    assert 429 in codes


_RENEW = "/api/v1/client-portal/renew"


def _expired_token(access: dict[str, Any], office: Oficina, version: int, days_ago: int) -> str:
    """Un enlace que venció hace `days_ago` días, firmado con la versión dada."""
    now = datetime.datetime.now(datetime.UTC)
    issued = now - datetime.timedelta(days=days_ago + 30)
    return issue_portal_link(
        _KEY[0],
        uuid.UUID(access["id"]),
        office.organization_id,
        version,
        now - datetime.timedelta(days=days_ago),
        now=issued,
    )


_KEY: list[str] = []


def test_un_enlace_vencido_pide_uno_nuevo_al_correo_registrado(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    _KEY[:] = [settings.signing_key()]
    office, lawyer, case_id = _case(dispositivo, db)
    access = _invite(lawyer, case_id)
    anonymous = dispositivo()
    expired = _expired_token(access, office, 1, days_ago=2)
    assert anonymous.post(_VIEW, json={"token": expired}).status_code == 404

    asked = anonymous.post(_RENEW, json={"token": expired})

    assert asked.status_code == 202, asked.text
    assert len(_invites(db)) == 2
    assert _invites(db)[-1]["renewed"] is True
    email = invite_email(db, _invites(db)[-1], settings)
    assert email is not None
    assert email.to == "cliente@example.com"
    assert "enlace nuevo" in email.subject
    fresh = _token_of_last_invite(db, settings)
    assert anonymous.post(_VIEW, json={"token": fresh}).status_code == 200
    assert _actions(db, office, "client_portal_renewed") == 1
    # El enlace vencido no puede renovarse otra vez: ya fue reemplazado.
    anonymous.post(_RENEW, json={"token": expired})
    assert len(_invites(db)) == 2


def test_pedir_un_enlace_nuevo_responde_igual_cuando_no_hay_nada_que_renovar(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    _KEY[:] = [settings.signing_key()]
    office, lawyer, case_id = _case(dispositivo, db)
    access = _invite(lawyer, case_id)
    anonymous = dispositivo()
    too_old = _expired_token(access, office, 1, days_ago=100)
    lawyer.delete(f"{_CASES}/{case_id}/portal/accesses/{access['id']}")
    revoked = _expired_token(access, office, 1, days_ago=2)

    answers = [
        anonymous.post(_RENEW, json={"token": token}) for token in (too_old, revoked, "inventado")
    ]

    assert {answer.status_code for answer in answers} == {202}
    assert len({answer.text for answer in answers}) == 1
    assert len(_invites(db)) == 1
    assert _actions(db, office, "client_portal_renewed") == 0


_MESSAGES = "/api/v1/client-portal/messages"


def _message_jobs(db: Session) -> list[dict[str, Any]]:
    jobs = db.scalars(select(Job).where(Job.kind == "email_send").order_by(Job.id)).all()
    return [dict(job.payload) for job in jobs if job.payload.get("template") == MESSAGE_TEMPLATE]


def _ready_client(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> tuple[Oficina, TestClient, str, TestClient, str]:
    """Un despacho con un caso, un cliente invitado que ya aceptó el aviso y su enlace."""
    office, lawyer, case_id = _case(dispositivo, db)
    _invite(lawyer, case_id)
    token = _token_of_last_invite(db, settings)
    anonymous = dispositivo()
    assert anonymous.post(_ACCEPT, json={"token": token}).status_code == 204
    return office, lawyer, case_id, anonymous, token


def test_el_cliente_escribe_y_el_despacho_lo_lee_sin_que_el_correo_copie_el_texto(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, lawyer, case_id, anonymous, token = _ready_client(dispositivo, db, settings)

    sent = anonymous.post(_MESSAGES, json={"token": token, "body": "  ¿Cómo va mi caso?  "})
    second = anonymous.post(_MESSAGES, json={"token": token, "body": "Otra duda"})

    assert sent.status_code == 201, sent.text
    assert sent.json()["body"] == "¿Cómo va mi caso?"
    assert second.status_code == 201
    assert len(_message_jobs(db)) == 1  # los mensajes seguidos se juntan en un solo aviso
    email = message_email(db, _message_jobs(db)[0], settings)
    assert email is not None
    assert "María Pérez" in email.subject
    assert "¿Cómo va mi caso?" not in email.text
    assert f"/app/casos/{case_id}" in email.text
    assert _actions(db, office, "client_portal_message_sent") == 2
    own = anonymous.post(_VIEW, json={"token": token}).json()["messages"]
    assert [item["body"] for item in own] == ["Otra duda", "¿Cómo va mi caso?"]

    inbox = lawyer.get(f"{_CASES}/{case_id}/portal/messages").json()
    assert inbox["unread_count"] == 2
    assert inbox["items"][0]["client_name"] == "María Pérez"
    assert lawyer.post(f"{_CASES}/{case_id}/portal/messages/read").status_code == 204
    after = lawyer.get(f"{_CASES}/{case_id}/portal/messages").json()
    assert after["unread_count"] == 0
    assert all(item["read_at"] is not None for item in after["items"])


def test_el_cliente_no_escribe_sin_aceptar_el_aviso_ni_con_un_enlace_cerrado(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    _, lawyer, case_id = _case(dispositivo, db)
    access = _invite(lawyer, case_id)
    token = _token_of_last_invite(db, settings)
    anonymous = dispositivo()

    before = anonymous.post(_MESSAGES, json={"token": token, "body": "Hola"})
    anonymous.post(_ACCEPT, json={"token": token})
    empty = anonymous.post(_MESSAGES, json={"token": token, "body": "   "})
    lawyer.delete(f"{_CASES}/{case_id}/portal/accesses/{access['id']}")
    after = anonymous.post(_MESSAGES, json={"token": token, "body": "Hola"})

    assert before.status_code == 409
    assert empty.status_code == 422
    assert after.status_code == 404
    assert _message_jobs(db) == []


def test_un_caso_archivado_ya_no_recibe_mensajes(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    _, lawyer, case_id, anonymous, token = _ready_client(dispositivo, db, settings)
    assert lawyer.post(f"{_CASES}/{case_id}/close").status_code == 200

    response = anonymous.post(_MESSAGES, json={"token": token, "body": "Hola"})

    assert response.status_code == 409


def test_solo_quien_maneja_el_portal_lee_los_mensajes_y_hay_tope_por_acceso(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office, lawyer, case_id, anonymous, token = _ready_client(dispositivo, db, settings)
    assistant = crear_miembro(db, office, "asistente.mensajes@example.com", "assistant")
    lawyer.post(f"{_CASES}/{case_id}/members", json={"user_id": str(assistant.id)})
    assistant_client = _session(dispositivo, db, assistant)

    codes = [
        anonymous.post(_MESSAGES, json={"token": token, "body": f"Mensaje {n}"}).status_code
        for n in range(11)
    ]

    assert assistant_client.get(f"{_CASES}/{case_id}/portal/messages").status_code == 403
    assert assistant_client.post(f"{_CASES}/{case_id}/portal/messages/read").status_code == 403
    assert codes[:10] == [201] * 10
    assert codes[10] == 429
