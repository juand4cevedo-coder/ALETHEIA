"""Renovación automática (ADR-058, etapa 2): el cobro a la fuente vinculada y sus reintentos."""

import datetime
import uuid

import pytest
from pydantic import Secret
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import Job, PaymentReceipt, PaymentSource, Plan, Subscription
from app.services import checkout, payment_emails, renewals
from tests.organizations import Oficina, crear_oficina

_PRECIO = 29_900


def _con_wompi(settings: Settings, *, encendida: bool = True) -> Settings:
    return settings.model_copy(
        update={
            "recurring_payments_enabled": encendida,
            "wompi_public_key": "pub_test_x",
            "wompi_private_key": Secret("prv_test_x"),
            "wompi_integrity_secret": Secret("test_integrity_x"),
            "wompi_events_secret": Secret("test_events_x"),
        }
    )


def _vence_en(
    db: Session, office: Oficina, dias: float, *, con_fuente: bool = True
) -> tuple[Subscription, datetime.datetime]:
    """Un despacho con el plan Esencial pagado que vence en `dias`, y su fuente de pago activa."""
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = db.scalars(
        select(Subscription).where(Subscription.organization_id == office.organization_id)
    ).one()
    esencial = db.scalars(select(Plan).where(Plan.code == "essential")).one()
    fin = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=dias)
    subscription.plan_id = esencial.id
    subscription.status = "active"
    subscription.access_source = "payment"
    subscription.billing_cycle = "monthly"
    subscription.current_period_end = fin
    subscription.pending_checkout_reference = None
    if con_fuente:
        ahora = datetime.datetime.now(datetime.UTC)
        db.add(
            PaymentSource(
                organization_id=office.organization_id,
                created_by=office.owner.id,
                kind="nequi",
                status="active",
                gateway_source_id=3891,
                phone_last4="4567",
                consent_version="2026-11-24",
                consent_accepted_at=ahora,
                linked_at=ahora,
            )
        )
    db.flush()
    return subscription, fin


def _cobro(
    monkeypatch: pytest.MonkeyPatch, estado: str, *, final: str | None = None
) -> list[dict[str, object]]:
    """Simula Wompi: el cobro nace con `estado` y, si hay `final`, se resuelve a la primera
    consulta, como en el entorno de pruebas de Wompi."""
    llamadas: list[dict[str, object]] = []
    monkeypatch.setattr(renewals, "_pause", lambda: None)

    def cobrar(_creds: object, **kwargs: object) -> wompi.Transaccion:
        llamadas.append(dict(kwargs))
        return wompi.Transaccion(
            id=f"tx-{len(llamadas)}",
            status=estado,
            reference=str(kwargs["reference"]),
            amount_in_cents=int(str(kwargs["amount_in_cents"])),
            payment_method_type="NEQUI",
        )

    def consultar(_creds: object, identificador: str) -> wompi.Transaccion:
        cobro = llamadas[-1]
        return wompi.Transaccion(
            id=identificador,
            status=final or estado,
            reference=str(cobro["reference"]),
            amount_in_cents=int(str(cobro["amount_in_cents"])),
            payment_method_type="NEQUI",
        )

    monkeypatch.setattr(wompi, "cobrar_con_fuente", cobrar)
    monkeypatch.setattr(wompi, "consultar_transaccion", consultar)
    return llamadas


def _tareas(db: Session, kind: str) -> list[Job]:
    return list(db.scalars(select(Job).where(Job.kind == kind)))


def test_un_cobro_aprobado_renueva_suma_el_periodo_emite_el_comprobante_y_agenda_el_siguiente(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription, fin = _vence_en(db, office, 1)
    llamadas = _cobro(monkeypatch, "APPROVED")

    resultado = renewals.attempt(db, _con_wompi(settings), office.organization_id, fin, 1)

    assert resultado == "approved"
    (llamada,) = llamadas
    assert llamada["source_id"] == 3891
    assert llamada["amount_in_cents"] == _PRECIO * 100
    assert llamada["customer_email"] == office.owner.email
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    db.refresh(subscription)
    assert subscription.current_period_end is not None
    # Renovar antes de vencer suma el mes nuevo al que ya estaba pagado.
    assert subscription.current_period_end >= fin + datetime.timedelta(days=28)
    assert subscription.pending_checkout_reference is None
    assert db.scalars(select(PaymentReceipt)).one().amount_cop == _PRECIO
    # Y queda agendado el cobro del periodo siguiente.
    siguientes = [
        tarea
        for tarea in _tareas(db, "renewal_charge")
        if tarea.payload["period_end"] == subscription.current_period_end.isoformat()
    ]
    assert len(siguientes) == 1


def test_apagada_no_cobra_nada(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _, fin = _vence_en(db, office, 1)
    llamadas = _cobro(monkeypatch, "APPROVED")

    resultado = renewals.attempt(
        db, _con_wompi(settings, encendida=False), office.organization_id, fin, 1
    )

    assert resultado == "skipped"
    assert llamadas == []


def test_sin_fuente_activa_o_con_la_fuente_cancelada_no_cobra(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    sin_fuente = crear_oficina(db)
    _, fin_a = _vence_en(db, sin_fuente, 1, con_fuente=False)
    cancelada = crear_oficina(db)
    _, fin_b = _vence_en(db, cancelada, 1)
    set_tenant(db, TenantContext(cancelada.organization_id, cancelada.owner.id))
    db.scalars(select(PaymentSource)).one().status = "canceled"
    db.flush()
    llamadas = _cobro(monkeypatch, "APPROVED")
    con_wompi = _con_wompi(settings)

    assert renewals.attempt(db, con_wompi, sin_fuente.organization_id, fin_a, 1) == "skipped"
    assert renewals.attempt(db, con_wompi, cancelada.organization_id, fin_b, 1) == "skipped"

    assert llamadas == []


def test_un_periodo_que_ya_se_renovo_no_se_cobra_otra_vez(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription, fin = _vence_en(db, office, 1)
    # Alguien renovó a mano: el periodo de la tarea ya no es el vigente.
    subscription.current_period_end = fin + datetime.timedelta(days=30)
    db.flush()
    llamadas = _cobro(monkeypatch, "APPROVED")

    assert renewals.attempt(db, _con_wompi(settings), office.organization_id, fin, 1) == "skipped"
    assert llamadas == []


def test_con_un_cobro_en_curso_no_se_cobra_dos_veces(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription, fin = _vence_en(db, office, 1)
    subscription.pending_checkout_reference = checkout.referencia_nueva(
        office.organization_id, "essential", "monthly"
    )
    db.flush()
    llamadas = _cobro(monkeypatch, "APPROVED")

    assert renewals.attempt(db, _con_wompi(settings), office.organization_id, fin, 1) == "skipped"
    assert llamadas == []


def test_un_cobro_rechazado_agenda_el_siguiente_intento_a_los_tres_dias(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription, fin = _vence_en(db, office, 1)
    _cobro(monkeypatch, "DECLINED")

    resultado = renewals.attempt(db, _con_wompi(settings), office.organization_id, fin, 1)

    assert resultado == "failed"
    db.refresh(subscription)
    assert subscription.status == "active"  # no se toca el plan por un cobro fallido
    segundo = [tarea for tarea in _tareas(db, "renewal_charge") if tarea.payload["attempt"] == 2]
    assert len(segundo) == 1
    espera = segundo[0].run_after - datetime.datetime.now(datetime.UTC)
    assert datetime.timedelta(days=2, hours=23) < espera <= renewals.RETRY_EVERY


def test_si_el_tercer_intento_tampoco_entra_se_avisa_al_responsable_y_no_se_reintenta_mas(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _, fin = _vence_en(db, office, -2)
    _cobro(monkeypatch, "ERROR")

    resultado = renewals.attempt(
        db, _con_wompi(settings), office.organization_id, fin, renewals.MAX_ATTEMPTS
    )

    assert resultado == "gave_up"
    assert [t for t in _tareas(db, "renewal_charge") if t.payload["attempt"] == 4] == []
    avisos = [
        tarea
        for tarea in _tareas(db, "email_send")
        if tarea.payload.get("template") == payment_emails.FAILED_TEMPLATE
    ]
    assert len(avisos) == 1
    assert avisos[0].payload["user_id"] == str(office.owner.id)


def test_un_cobro_en_tramite_deja_la_reconciliacion_y_el_siguiente_intento(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription, fin = _vence_en(db, office, 1)
    _cobro(monkeypatch, "PENDING")

    resultado = renewals.attempt(db, _con_wompi(settings), office.organization_id, fin, 1)

    assert resultado == "pending"
    db.refresh(subscription)
    assert subscription.pending_checkout_reference is not None
    assert len(_tareas(db, "payment_reconcile")) == 1
    assert [t.payload["attempt"] for t in _tareas(db, "renewal_charge")] == [2]


def test_si_wompi_rechaza_la_peticion_cuenta_como_un_intento_fallido(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _, fin = _vence_en(db, office, 1)

    def rechaza(_creds: object, **_kw: object) -> wompi.Transaccion:
        raise wompi.WompiRechazadoError("Wompi respondió 422")

    monkeypatch.setattr(wompi, "cobrar_con_fuente", rechaza)

    resultado = renewals.attempt(db, _con_wompi(settings), office.organization_id, fin, 1)

    assert resultado == "failed"


def test_agendar_solo_ocurre_con_una_fuente_activa(db: Session) -> None:
    con = crear_oficina(db)
    sin = crear_oficina(db)
    _, fin_con = _vence_en(db, con, 10)
    _, fin_sin = _vence_en(db, sin, 10, con_fuente=False)

    # Como en producción: el cobro se agenda con el contexto del propio despacho.
    set_tenant(db, TenantContext(con.organization_id, con.owner.id))
    renewals.schedule_if_linked(db, con.organization_id, fin_con)
    set_tenant(db, TenantContext(sin.organization_id, sin.owner.id))
    renewals.schedule_if_linked(db, sin.organization_id, fin_sin)

    tareas = _tareas(db, "renewal_charge")
    assert [t.payload["organization_id"] for t in tareas] == [str(con.organization_id)]
    # Se cobra un día antes de vencer.
    esperado = fin_con - renewals.LEAD
    assert abs((tareas[0].run_after - esperado).total_seconds()) < 5


def test_el_aviso_previo_de_la_renovacion_automatica_dice_cuando_cuanto_y_como_cancelar(
    db: Session, settings: Settings
) -> None:
    office = crear_oficina(db)
    _, fin = _vence_en(db, office, 7)
    payload = {
        "organization_id": str(office.organization_id),
        "user_id": str(office.owner.id),
        "plan_code": "essential",
        "cycle": "monthly",
        "period_end": fin.isoformat(),
    }

    correo = payment_emails.reminder_email(db, payload, settings)

    assert correo is not None
    assert "renovación automática" in correo.text
    assert "4567" in correo.text
    assert "$29.900 COP" in correo.text
    assert "/app/facturacion" in correo.text


def test_el_aviso_de_fallo_no_sale_si_el_plan_ya_se_renovo(db: Session, settings: Settings) -> None:
    office = crear_oficina(db)
    subscription, fin = _vence_en(db, office, 1)
    payload = {
        "organization_id": str(office.organization_id),
        "user_id": str(office.owner.id),
        "plan_code": "essential",
        "cycle": "monthly",
        "period_end": fin.isoformat(),
    }
    assert payment_emails.renewal_failed_email(db, payload, settings) is not None

    subscription.current_period_end = fin + datetime.timedelta(days=30)
    db.flush()

    assert payment_emails.renewal_failed_email(db, payload, settings) is None
    assert uuid.UUID(payload["organization_id"]) == office.organization_id


def test_el_cobro_con_fuente_manda_la_fuente_y_la_firma_y_no_un_medio_de_pago(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    enviado: dict[str, object] = {}

    def falsa(url: str, **kwargs: object) -> dict[str, object]:
        enviado["url"] = url
        enviado["cuerpo"] = kwargs["cuerpo"]
        enviado["bearer"] = kwargs["bearer"]
        return {
            "data": {
                "id": "1612255-1-1",
                "status": "PENDING",
                "reference": "ref-1",
                "amount_in_cents": 2_990_000,
            }
        }

    monkeypatch.setattr(wompi, "_llamar", falsa)
    creds = wompi.Credenciales(
        public_key="pub_test_x",
        private_key="prv_test_x",
        integrity_secret="test_integrity_x",  # noqa: S106
        events_secret="test_events_x",  # noqa: S106
        base_url="https://sandbox.wompi.co/v1",
    )

    transaccion = wompi.cobrar_con_fuente(
        creds,
        source_id=3891,
        amount_in_cents=2_990_000,
        reference="ref-1",
        customer_email="ana@example.com",
    )

    cuerpo = enviado["cuerpo"]
    assert isinstance(cuerpo, dict)
    assert enviado["url"] == "https://sandbox.wompi.co/v1/transactions"
    assert enviado["bearer"] == "prv_test_x"
    assert cuerpo["payment_source_id"] == 3891
    assert "payment_method" not in cuerpo
    assert cuerpo["signature"] == wompi.firma_de_integridad(
        "ref-1", 2_990_000, "COP", "test_integrity_x"
    )
    assert transaccion.status == "PENDING"


def test_el_trabajador_conoce_la_tarea_de_renovacion() -> None:
    from app.worker.handlers import HANDLERS

    assert renewals.CHARGE_JOB in HANDLERS


def test_un_cobro_que_nace_pendiente_y_se_resuelve_en_segundos_se_aplica_de_inmediato(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    subscription, fin = _vence_en(db, office, 1)
    _cobro(monkeypatch, "PENDING", final="APPROVED")

    resultado = renewals.attempt(db, _con_wompi(settings), office.organization_id, fin, 1)

    assert resultado == "approved"
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    db.refresh(subscription)
    assert subscription.current_period_end is not None
    assert subscription.current_period_end > fin + datetime.timedelta(days=28)


def test_un_cobro_que_nace_pendiente_y_se_rechaza_en_segundos_cuenta_como_fallido(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _, fin = _vence_en(db, office, 1)
    _cobro(monkeypatch, "PENDING", final="DECLINED")

    resultado = renewals.attempt(db, _con_wompi(settings), office.organization_id, fin, 1)

    assert resultado == "failed"
