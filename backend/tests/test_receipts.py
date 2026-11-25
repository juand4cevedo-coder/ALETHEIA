"""Comprobantes de pago de ALETHEIA: se emiten una vez por pago aprobado y se descargan en PDF."""

import datetime
import io

import pytest
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import Job, PaymentReceipt
from app.services import checkout, payment_emails, payments, receipt_pdf, receipts
from tests.conftest import NuevoCliente
from tests.organizations import Oficina, crear_oficina
from tests.test_cases_list import _sesion
from tests.test_payments import (
    _MENSUAL_ESENCIAL_CENTAVOS,
    _consultar_falsa,
    _credenciales,
    _en_prueba,
    _webhook,
)


def _pagar(db: Session, monkeypatch: pytest.MonkeyPatch, office: Oficina, tx: str = "tx-1") -> None:
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly")
    transaccion = wompi.Transaccion(
        id=tx,
        status="APPROVED",
        reference=reference,
        amount_in_cents=_MENSUAL_ESENCIAL_CENTAVOS,
        payment_method_type="CARD",
    )
    monkeypatch.setattr(wompi, "consultar_transaccion", _consultar_falsa(transaccion))
    payments.procesar_evento(db, _webhook(tx, "APPROVED"), _credenciales())


def _comprobantes(db: Session, office: Oficina) -> list[PaymentReceipt]:
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    return list(db.scalars(select(PaymentReceipt)))


def test_un_pago_aprobado_emite_un_comprobante_con_su_numero(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)

    _pagar(db, monkeypatch, office)

    (comprobante,) = _comprobantes(db, office)
    anio = datetime.datetime.now(receipts._BOGOTA).year
    assert comprobante.number.startswith(f"CP-{anio}-")
    assert comprobante.amount_cop == 29_900
    assert comprobante.billing_cycle == "monthly"
    assert comprobante.payment_method == "CARD"
    assert comprobante.gateway_transaction_id == "tx-1"
    assert comprobante.period_end > comprobante.period_start
    assert comprobante.buyer_email == office.owner.email


def test_el_mismo_pago_repetido_no_emite_otro_comprobante(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)
    _pagar(db, monkeypatch, office)
    _pagar(db, monkeypatch, office)  # el mismo evento llega otra vez

    assert len(_comprobantes(db, office)) == 1


def test_dos_pagos_distintos_numeran_en_orden(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)
    _pagar(db, monkeypatch, office, "tx-1")
    _pagar(db, monkeypatch, office, "tx-2")

    primero, segundo = sorted(_comprobantes(db, office), key=lambda c: c.number)
    assert int(segundo.number.rsplit("-", 1)[1]) == int(primero.number.rsplit("-", 1)[1]) + 1


def test_el_correo_del_pago_nombra_el_comprobante(
    db: Session, monkeypatch: pytest.MonkeyPatch, settings: Settings
) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)
    _pagar(db, monkeypatch, office)
    (comprobante,) = _comprobantes(db, office)
    job = db.scalars(select(Job).where(Job.kind == "email_send")).first()
    assert job is not None

    correo = payment_emails.receipt_email(db, job.payload, settings)

    assert correo is not None
    assert comprobante.number in correo.text
    assert "/app/facturacion" in correo.text


def test_el_pdf_trae_el_numero_el_valor_y_aclara_que_no_es_factura(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)
    _pagar(db, monkeypatch, office)
    (comprobante,) = _comprobantes(db, office)

    pdf = receipt_pdf.render(comprobante)

    assert pdf.startswith(b"%PDF")
    (pagina,) = PdfReader(io.BytesIO(pdf)).pages
    texto = pagina.extract_text()
    for esperado in (
        "Comprobante de pago",
        comprobante.number,
        "Aletheia",
        "EMITIDO POR",
        "RECIBIDO DE",
        "NIT 1214744661-9",
        "Total pagado",
        "No aplica",
        "No es una factura electrónica",
        "PAGADO",
    ):
        assert esperado in texto, esperado
    assert receipts.cop(comprobante.amount_cop) in texto


def test_lo_cobrado_en_el_ano_suma_los_comprobantes(
    owner_db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    db = owner_db
    office = crear_oficina(db)
    _en_prueba(db, office)
    _pagar(db, monkeypatch, office, "tx-1")
    _pagar(db, monkeypatch, office, "tx-2")
    anio = datetime.datetime.now(receipts._BOGOTA).year

    resultado = receipts.collected_in(db, anio)

    assert resultado.receipts >= 2
    assert resultado.collected_cop >= 2 * 29_900
    assert receipts.collected_in(db, anio - 5).receipts == 0


def test_el_responsable_lista_y_descarga_sus_comprobantes_y_los_demas_roles_no(
    dispositivo: NuevoCliente, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _en_prueba(db, office)
    _pagar(db, monkeypatch, office)
    (comprobante,) = _comprobantes(db, office)
    numero, comprobante_id = comprobante.number, comprobante.id
    cliente = _sesion(dispositivo, office.owner)

    lista = cliente.get("/api/v1/billing/receipts")
    assert lista.status_code == 200, lista.text
    assert [fila["number"] for fila in lista.json()] == [numero]
    assert lista.headers["cache-control"] == "no-store"

    pdf = cliente.get(f"/api/v1/billing/receipts/{comprobante_id}/pdf")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert numero in pdf.headers["content-disposition"]
    assert pdf.content.startswith(b"%PDF")

    inexistente = cliente.get("/api/v1/billing/receipts/00000000-0000-0000-0000-000000000000/pdf")
    assert inexistente.status_code == 404
    assert dispositivo().get("/api/v1/billing/receipts").status_code == 401


def test_el_comprobante_de_un_despacho_no_se_ve_desde_otro(
    dispositivo: NuevoCliente, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    uno = crear_oficina(db)
    otro = crear_oficina(db)
    _en_prueba(db, uno)
    _pagar(db, monkeypatch, uno)
    (comprobante,) = _comprobantes(db, uno)
    comprobante_id = comprobante.id
    cliente_otro = _sesion(dispositivo, otro.owner)

    assert cliente_otro.get("/api/v1/billing/receipts").json() == []
    assert cliente_otro.get(f"/api/v1/billing/receipts/{comprobante_id}/pdf").status_code == 404
