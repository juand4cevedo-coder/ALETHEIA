"""Recuperar el segundo factor sin teléfono ni códigos: espera de seguridad, avisos y límites."""

import datetime
import re
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core import two_factor as totp
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import (
    AuditLog,
    Job,
    TwoFactorRecovery,
    TwoFactorRecoveryCode,
    User,
    UserTwoFactor,
)
from app.services import two_factor_recovery as service
from app.services.two_factor_recovery_emails import owner_notice_email, request_email
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, crear_miembro, crear_oficina, crear_persona
from tests.test_two_factor import _activate, _verified_client

_BASE = "/api/v1/auth/two-factor-recovery"
_LOGIN = "/api/v1/auth/login"
_SECOND_STEP = "/api/v1/auth/login/two-factor"


def _payloads(db: Session, template: str) -> list[dict[str, str]]:
    jobs = db.scalars(select(Job).where(Job.kind == "email_send").order_by(Job.id)).all()
    return [dict(job.payload) for job in jobs if job.payload.get("template") == template]


def _token(text: str, marker: str) -> str:
    found = re.search(rf"#{marker}=([\w.-]+)", text)
    assert found is not None, text
    return found.group(1)


def _with_factor(dispositivo: NuevoCliente, db: Session, user: User) -> tuple[TestClient, bytes]:
    client = _verified_client(dispositivo, db, user)
    secret, _ = _activate(client)
    return client, secret


def _confirm_token(db: Session, settings: Settings, user: User) -> str:
    """Pide la recuperación por la API y devuelve el token del correo que se enviaría."""
    assert user.email  # el correo se pide con la misma dirección de la cuenta
    payload = _payloads(db, service.REQUEST_TEMPLATE)[-1]
    email = request_email(db, payload, settings)
    assert email is not None
    return _token(email.text, "t")


def _pedir_y_confirmar(
    dispositivo: NuevoCliente, db: Session, settings: Settings, user: User
) -> dict[str, str]:
    client = dispositivo()
    assert client.post(_BASE, json={"email": user.email}).status_code == 202
    token = _confirm_token(db, settings, user)
    confirmed = client.post(f"{_BASE}/confirm", json={"token": token, "password": CLAVE})
    assert confirmed.status_code == 200, confirmed.text
    return dict(confirmed.json())


def _events(db: Session, organization_id: uuid.UUID, user_id: uuid.UUID, action: str) -> int:
    set_tenant(db, TenantContext(organization_id=organization_id, user_id=user_id))
    return len(
        db.scalars(
            select(AuditLog).where(
                AuditLog.organization_id == organization_id, AuditLog.action == action
            )
        ).all()
    )


def _recovery(db: Session, user: User) -> TwoFactorRecovery:
    found = db.scalar(select(TwoFactorRecovery).where(TwoFactorRecovery.user_id == user.id))
    assert found is not None
    db.refresh(found)
    return found


def _wait_is_over(db: Session, user: User) -> None:
    """Hace como si la espera de 24 horas ya hubiera pasado."""
    now = datetime.datetime.now(datetime.UTC)
    db.execute(
        update(TwoFactorRecovery)
        .where(TwoFactorRecovery.user_id == user.id)
        .values(
            created_at=now - datetime.timedelta(hours=25),
            available_at=now - datetime.timedelta(hours=1),
            expires_at=now + datetime.timedelta(days=6),
        )
    )
    db.flush()


def test_pedir_la_recuperacion_responde_igual_exista_o_no_la_cuenta(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    _with_factor(dispositivo, db, office.owner)
    sin_factor = crear_persona(db, "sin-factor@example.com")
    client = dispositivo()

    respuestas = [
        client.post(_BASE, json={"email": correo})
        for correo in (office.owner.email, sin_factor.email, "nadie@example.com")
    ]

    assert {respuesta.status_code for respuesta in respuestas} == {202}
    assert len({respuesta.text for respuesta in respuestas}) == 1
    # Solo la cuenta con segundo factor recibe el enlace.
    enviados = _payloads(db, service.REQUEST_TEMPLATE)
    assert [payload["user_id"] for payload in enviados] == [str(office.owner.id)]


def test_pedir_la_recuperacion_se_limita_por_cuenta(dispositivo: NuevoCliente, db: Session) -> None:
    client = dispositivo()
    for _ in range(3):
        assert client.post(_BASE, json={"email": "cualquiera@example.com"}).status_code == 202

    excedido = client.post(_BASE, json={"email": "cualquiera@example.com"})

    assert excedido.status_code == 429
    assert int(excedido.headers["Retry-After"]) > 0


def test_confirmar_abre_la_espera_y_avisa_a_la_persona_y_a_los_duenos(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    abogada = crear_miembro(db, office, "abogada@example.com", "lawyer")
    _with_factor(dispositivo, db, abogada)

    confirmada = _pedir_y_confirmar(dispositivo, db, settings, abogada)

    recovery = _recovery(db, abogada)
    ahora = datetime.datetime.now(datetime.UTC)
    assert recovery.available_at - ahora > datetime.timedelta(hours=23, minutes=59)
    assert recovery.available_at - ahora <= datetime.timedelta(hours=24)
    assert confirmada["available_at"].startswith(recovery.available_at.strftime("%Y-%m-%dT%H:%M"))
    assert _events(db, office.organization_id, abogada.id, "two_factor_recovery_requested") == 1
    # La persona y el dueño reciben aviso; la persona no se avisa dos veces.
    assert [p["user_id"] for p in _payloads(db, service.STARTED_TEMPLATE)] == [str(abogada.id)]
    avisos = _payloads(db, service.OWNER_NOTICE_TEMPLATE)
    assert [p["user_id"] for p in avisos] == [str(office.owner.id)]
    aviso = owner_notice_email(db, avisos[0], settings)
    assert aviso is not None
    assert aviso.to == office.owner.email
    assert abogada.full_name in aviso.text
    assert "#c=" in aviso.text


def test_confirmar_con_otra_contrasena_o_un_enlace_alterado_no_abre_la_espera(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    _with_factor(dispositivo, db, office.owner)
    client = dispositivo()
    client.post(_BASE, json={"email": office.owner.email})
    token = _confirm_token(db, settings, office.owner)

    mala = client.post(f"{_BASE}/confirm", json={"token": token, "password": "otra frase larga"})
    alterado = client.post(f"{_BASE}/confirm", json={"token": token + "x", "password": CLAVE})
    ajeno = client.post(f"{_BASE}/confirm", json={"token": "no-es-un-token", "password": CLAVE})

    assert mala.status_code == 401
    assert alterado.status_code == 400
    assert ajeno.status_code == 400
    assert db.scalar(select(TwoFactorRecovery)) is None


def test_confirmar_dos_veces_no_reinicia_la_espera_ni_repite_los_avisos(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    abogada = crear_miembro(db, office, "abogada2@example.com", "lawyer")
    _with_factor(dispositivo, db, abogada)
    primera = _pedir_y_confirmar(dispositivo, db, settings, abogada)

    segunda = _pedir_y_confirmar(dispositivo, db, settings, abogada)

    assert segunda == primera
    assert len(_payloads(db, service.STARTED_TEMPLATE)) == 1
    assert len(_payloads(db, service.OWNER_NOTICE_TEMPLATE)) == 1


def test_un_dueno_unico_solo_avisa_a_si_mismo(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    _with_factor(dispositivo, db, office.owner)

    _pedir_y_confirmar(dispositivo, db, settings, office.owner)

    assert _payloads(db, service.OWNER_NOTICE_TEMPLATE) == []
    assert len(_payloads(db, service.STARTED_TEMPLATE)) == 1


def test_el_enlace_de_los_duenos_cancela_la_recuperacion_una_sola_vez(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    abogada = crear_miembro(db, office, "abogada3@example.com", "lawyer")
    _with_factor(dispositivo, db, abogada)
    _pedir_y_confirmar(dispositivo, db, settings, abogada)
    aviso = owner_notice_email(db, _payloads(db, service.OWNER_NOTICE_TEMPLATE)[0], settings)
    assert aviso is not None
    token = _token(aviso.text, "c")
    outsider = dispositivo()

    cancelada = outsider.post(f"{_BASE}/cancel", json={"token": token})
    repetida = outsider.post(f"{_BASE}/cancel", json={"token": token})

    assert cancelada.status_code == 204, cancelada.text
    assert repetida.status_code == 400
    assert _recovery(db, abogada).canceled_at is not None
    assert _events(db, office.organization_id, abogada.id, "two_factor_recovery_canceled") == 1
    assert [p["user_id"] for p in _payloads(db, service.CANCELED_TEMPLATE)] == [str(abogada.id)]
    # Cancelada, ya no se puede terminar, aunque pase la espera.
    _wait_is_over(db, abogada)
    terminar = outsider.post(f"{_BASE}/complete", json={"email": abogada.email, "password": CLAVE})
    assert terminar.status_code == 404


def test_terminar_antes_de_la_espera_dice_cuando_termina(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    _with_factor(dispositivo, db, office.owner)
    _pedir_y_confirmar(dispositivo, db, settings, office.owner)

    pronto = dispositivo().post(
        f"{_BASE}/complete", json={"email": office.owner.email, "password": CLAVE}
    )

    assert pronto.status_code == 409
    assert "La espera de seguridad termina el" in pronto.json()["detail"]
    assert db.scalar(select(UserTwoFactor)) is not None


def test_terminar_exige_la_contrasena_y_un_pedido_abierto(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db)
    _with_factor(dispositivo, db, office.owner)
    client = dispositivo()

    mala = client.post(
        f"{_BASE}/complete", json={"email": office.owner.email, "password": "otra frase larga"}
    )
    sin_pedido = client.post(
        f"{_BASE}/complete", json={"email": office.owner.email, "password": CLAVE}
    )
    sin_cuenta = client.post(
        f"{_BASE}/complete", json={"email": "nadie@example.com", "password": CLAVE}
    )

    assert mala.status_code == 401
    assert sin_cuenta.status_code == 401
    assert mala.json()["detail"] == sin_cuenta.json()["detail"]
    assert sin_pedido.status_code == 404


def test_terminada_la_espera_se_desactiva_el_segundo_factor_y_se_cierran_las_sesiones(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    abogada = crear_miembro(db, office, "abogada4@example.com", "lawyer")
    abierta, _ = _with_factor(dispositivo, db, abogada)
    assert abierta.get("/api/v1/me").status_code == 200
    _pedir_y_confirmar(dispositivo, db, settings, abogada)
    _wait_is_over(db, abogada)
    client = dispositivo()

    terminada = client.post(f"{_BASE}/complete", json={"email": abogada.email, "password": CLAVE})

    assert terminada.status_code == 204, terminada.text
    assert db.scalar(select(UserTwoFactor).where(UserTwoFactor.user_id == abogada.id)) is None
    assert (
        db.scalar(select(TwoFactorRecoveryCode).where(TwoFactorRecoveryCode.user_id == abogada.id))
        is None
    )
    assert _recovery(db, abogada).completed_at is not None
    assert _events(db, office.organization_id, abogada.id, "two_factor_recovery_completed") == 1
    assert [p["user_id"] for p in _payloads(db, service.COMPLETED_TEMPLATE)] == [str(abogada.id)]
    # La sesión que ya estaba abierta se cerró, y el ingreso vuelve a ser solo con contraseña.
    assert abierta.get("/api/v1/me").status_code == 401
    nueva = dispositivo()
    assert nueva.post(_LOGIN, json={"email": abogada.email, "password": CLAVE}).status_code == 204
    assert nueva.get("/api/v1/me").status_code == 200


def test_un_pedido_vencido_ya_no_se_puede_terminar(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    _with_factor(dispositivo, db, office.owner)
    _pedir_y_confirmar(dispositivo, db, settings, office.owner)
    now = datetime.datetime.now(datetime.UTC)
    db.execute(
        update(TwoFactorRecovery).values(
            created_at=now - datetime.timedelta(days=9),
            available_at=now - datetime.timedelta(days=8),
            expires_at=now - datetime.timedelta(days=1),
        )
    )
    db.flush()

    vencido = dispositivo().post(
        f"{_BASE}/complete", json={"email": office.owner.email, "password": CLAVE}
    )

    assert vencido.status_code == 404
    assert db.scalar(select(UserTwoFactor).where(UserTwoFactor.user_id == office.owner.id))


def test_ingresar_con_el_segundo_factor_cancela_el_pedido_pendiente(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    _, secret = _with_factor(dispositivo, db, office.owner)
    _pedir_y_confirmar(dispositivo, db, settings, office.owner)
    assert _recovery(db, office.owner).canceled_at is None

    ingreso = dispositivo()
    assert (
        ingreso.post(_LOGIN, json={"email": office.owner.email, "password": CLAVE}).status_code
        == 202
    )
    codigo = totp.code_for(secret, totp.current_step() + 1)
    segundo = ingreso.post(_SECOND_STEP, json={"code": codigo})

    assert segundo.status_code == 204, segundo.text
    assert _recovery(db, office.owner).canceled_at is not None
