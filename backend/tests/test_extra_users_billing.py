"""Cobro de los usuarios adicionales: el plan más cada persona por encima de las incluidas.

Cuentan los miembros y las invitaciones abiertas. En el pago anual, cada usuario adicional vale
diez meses, como el plan. Un plan sin adicionales no se puede pagar con un equipo más grande.
"""

import datetime
import io
import urllib.parse
import uuid

import pytest
from fastapi import FastAPI
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.api.deps import get_app_settings
from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import Invitation, Job, PaymentReceipt, Plan, Subscription
from app.services import checkout, payment_emails, payments, pricing, receipt_pdf, renewals
from tests.conftest import NuevoCliente
from tests.organizations import Oficina, crear_miembro, crear_oficina
from tests.test_cases_list import _sesion
from tests.test_checkout import _con_wompi, _en_prueba, _principal
from tests.test_payments import _consultar_falsa, _credenciales, _webhook
from tests.test_renewals import _cobro
from tests.test_renewals import _con_wompi as _con_renovacion


def _plan(db: Session, code: str) -> Plan:
    return db.scalars(select(Plan).where(Plan.code == code)).one()


def _equipo(db: Session, office: Oficina, personas: int) -> None:
    """Deja el despacho con `personas` miembros, el propietario incluido."""
    for numero in range(personas - 1):
        crear_miembro(db, office, f"persona{numero}-{uuid.uuid4().hex[:6]}@example.com", "lawyer")


def _monto(url: str) -> int:
    return int(urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["amount-in-cents"][0])


def _referencia(url: str) -> str:
    return urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["reference"][0]


# El cálculo, sin base de datos.


def _plan_suelto(monthly: int, annual: int | None, included: int, extra: int | None) -> Plan:
    return Plan(
        code="x",
        name="X",
        monthly_price_cop=monthly,
        annual_price_cop=annual,
        included_users=included,
        extra_user_price_cop=extra,
        storage_limit_bytes=1,
        max_file_bytes=1,
        is_public=True,
    )


def test_sin_adicionales_se_cobra_solo_el_plan() -> None:
    plan = _plan_suelto(149_900, 1_499_000, 8, 14_900)

    cotizacion = pricing.quote(plan, "monthly", pricing.extra_users_for(plan, 8) or 0)

    assert cotizacion is not None
    assert cotizacion.extra_users == 0
    assert cotizacion.total_cop == 149_900


def test_cada_persona_de_mas_suma_su_precio_al_mes() -> None:
    plan = _plan_suelto(149_900, 1_499_000, 8, 14_900)

    extra = pricing.extra_users_for(plan, 11)
    cotizacion = pricing.quote(plan, "monthly", extra or 0)

    assert extra == 3
    assert cotizacion is not None
    assert cotizacion.extra_users_cop == 3 * 14_900
    assert cotizacion.total_cop == 149_900 + 3 * 14_900


def test_en_el_pago_anual_cada_adicional_vale_diez_meses() -> None:
    plan = _plan_suelto(59_900, 599_000, 2, 19_900)

    cotizacion = pricing.quote(plan, "annual", 2)

    assert cotizacion is not None
    assert cotizacion.extra_user_unit_cop == 199_000
    assert cotizacion.total_cop == 599_000 + 2 * 199_000


def test_un_plan_sin_adicionales_no_admite_un_equipo_mas_grande() -> None:
    plan = _plan_suelto(29_900, 299_000, 1, None)

    assert pricing.extra_users_for(plan, 1) == 0
    assert pricing.extra_users_for(plan, 2) is None
    assert pricing.quote(plan, "monthly", 1) is None
    assert pricing.quote(plan, "monthly", 0) is not None


def test_un_plan_que_no_se_vende_por_ano_no_tiene_precio_anual() -> None:
    plan = _plan_suelto(449_900, None, 25, None)

    assert pricing.quote(plan, "annual", 0) is None


def test_la_referencia_lleva_los_adicionales_y_las_anteriores_valen_cero() -> None:
    organization_id = uuid.uuid7()

    nueva = checkout.leer_referencia(
        checkout.referencia_nueva(organization_id, "firm", "annual", 7)
    )
    anterior = checkout.leer_referencia(f"aletheia:{organization_id}:firm:monthly:{uuid.uuid7()}")

    assert nueva is not None
    assert nueva.extra_users == 7
    assert anterior is not None
    assert anterior.extra_users == 0


def test_profesional_admite_adicionales_a_19900(db: Session) -> None:
    profesional = _plan(db, "professional")

    assert profesional.extra_user_price_cop == 19_900
    assert profesional.included_users == 4


# El cobro: checkout web, Nequi y renovación.


def test_firma_con_doce_personas_cobra_dos_adicionales(db: Session, settings: Settings) -> None:
    office = crear_oficina(db, "firm")
    _en_prueba(db, office)
    _equipo(db, office, 12)
    principal = _principal(office.organization_id, office.owner.id, "owner")

    url = checkout.iniciar_checkout_web(db, _con_wompi(settings), principal, "firm", "monthly")

    assert _monto(url) == (149_900 + 2 * 19_900) * 100
    referencia = checkout.leer_referencia(_referencia(url))
    assert referencia is not None
    assert referencia.extra_users == 2


def test_las_invitaciones_abiertas_cuentan_como_usuarios(db: Session, settings: Settings) -> None:
    office = crear_oficina(db, "professional")
    _en_prueba(db, office)
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    for correo in ("a@example.com", "b@example.com", "c@example.com", "d@example.com"):
        db.add(
            Invitation(
                organization_id=office.organization_id,
                email=correo,
                role="assistant",
                invited_by=office.owner.id,
                token_hash=uuid.uuid4().bytes * 2,
                expires_at=datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=2),
            )
        )
    db.flush()
    principal = _principal(office.organization_id, office.owner.id, "owner")

    url = checkout.iniciar_checkout_web(
        db, _con_wompi(settings), principal, "professional", "annual"
    )

    # Propietario y cuatro invitaciones: cinco personas, una más de las cuatro incluidas.
    assert _monto(url) == (599_000 + 199_000) * 100


def test_nequi_tambien_cobra_los_adicionales(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db, "professional")
    _en_prueba(db, office)
    _equipo(db, office, 6)
    principal = _principal(office.organization_id, office.owner.id, "owner")
    cobrado: dict[str, object] = {}

    def crear(_creds: wompi.Credenciales, **kwargs: object) -> wompi.Transaccion:
        cobrado.update(kwargs)
        return wompi.Transaccion("tx-n", "PENDING", str(kwargs["reference"]), 0)

    monkeypatch.setattr(wompi, "crear_transaccion_nequi", crear)

    checkout.iniciar(
        db, _con_wompi(settings), principal, "professional", "monthly", "3001234567", "a", "p"
    )

    assert cobrado["amount_in_cents"] == (59_900 + 2 * 19_900) * 100


def test_un_equipo_que_no_cabe_en_el_plan_no_se_cobra(db: Session, settings: Settings) -> None:
    office = crear_oficina(db, "trial")
    _en_prueba(db, office)
    _equipo(db, office, 5)
    principal = _principal(office.organization_id, office.owner.id, "owner")

    with pytest.raises(checkout.EquipoNoCabeError) as error:
        checkout.iniciar_checkout_web(db, _con_wompi(settings), principal, "essential", "monthly")

    assert error.value.users == 5
    assert error.value.included == 2
    assert error.value.limit == 4
    subscription = db.scalars(
        select(Subscription).where(Subscription.organization_id == office.organization_id)
    ).one()
    assert subscription.pending_checkout_reference is None


def _aprobar(
    db: Session, monkeypatch: pytest.MonkeyPatch, reference: str, centavos: int, tx: str
) -> None:
    transaccion = wompi.Transaccion(
        id=tx,
        status="APPROVED",
        reference=reference,
        amount_in_cents=centavos,
        payment_method_type="CARD",
    )
    monkeypatch.setattr(wompi, "consultar_transaccion", _consultar_falsa(transaccion))
    payments.procesar_evento(db, _webhook(tx, "APPROVED"), _credenciales())


def _comprobante(db: Session, office: Oficina) -> PaymentReceipt | None:
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    return db.scalars(select(PaymentReceipt)).first()


def test_el_pago_con_adicionales_activa_y_los_anota_en_el_comprobante(
    db: Session, monkeypatch: pytest.MonkeyPatch, settings: Settings
) -> None:
    office = crear_oficina(db, "firm")
    _en_prueba(db, office)
    reference = checkout.referencia_nueva(office.organization_id, "firm", "annual", 3)

    _aprobar(db, monkeypatch, reference, (1_499_000 + 3 * 199_000) * 100, "tx-a")

    comprobante = _comprobante(db, office)
    assert comprobante is not None
    assert comprobante.amount_cop == 1_499_000 + 3 * 199_000
    assert comprobante.extra_users == 3
    assert comprobante.extra_users_cop == 3 * 199_000

    texto = PdfReader(io.BytesIO(receipt_pdf.render(comprobante))).pages[0].extract_text()
    assert "3 usuarios adicionales" in texto
    assert "$597.000 COP" in texto
    assert "$1.499.000 COP" in texto

    job = db.scalars(
        select(Job).where(
            Job.kind == "email_send",
            Job.payload["template"].astext == payment_emails.APPROVED_TEMPLATE,
        )
    ).first()
    assert job is not None
    correo = payment_emails.receipt_email(db, job.payload, settings)
    assert correo is not None
    assert "3 usuarios adicionales a $199.000 COP al año cada uno, $597.000 COP" in correo.text
    assert "$2.096.000 COP" in correo.text


def test_el_comprobante_sin_adicionales_no_muestra_esa_linea(
    db: Session, monkeypatch: pytest.MonkeyPatch, settings: Settings
) -> None:
    office = crear_oficina(db, "firm")
    _en_prueba(db, office)
    reference = checkout.referencia_nueva(office.organization_id, "firm", "monthly", 0)

    _aprobar(db, monkeypatch, reference, 149_900 * 100, "tx-b")

    comprobante = _comprobante(db, office)
    assert comprobante is not None
    assert comprobante.extra_users == 0
    texto = PdfReader(io.BytesIO(receipt_pdf.render(comprobante))).pages[0].extract_text()
    assert "adicional" not in texto


def test_un_pago_que_no_suma_los_adicionales_no_activa_nada(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db, "firm")
    subscription = _en_prueba(db, office)
    reference = checkout.referencia_nueva(office.organization_id, "firm", "monthly", 2)

    # Wompi cobró solo el plan, sin las dos personas de más que pide la referencia.
    _aprobar(db, monkeypatch, reference, 149_900 * 100, "tx-c")

    db.refresh(subscription)
    assert subscription.status == "trial"
    assert _comprobante(db, office) is None


def test_un_plan_sin_adicionales_no_se_activa_con_adicionales_en_la_referencia(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db, "essential")
    subscription = _en_prueba(db, office)
    reference = checkout.referencia_nueva(office.organization_id, "essential", "monthly", 1)

    _aprobar(db, monkeypatch, reference, 29_900 * 100, "tx-d")

    db.refresh(subscription)
    assert subscription.status == "trial"


def test_la_renovacion_automatica_cobra_los_adicionales_del_dia(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    from tests.test_renewals import _vence_en

    office = crear_oficina(db, "firm")
    subscription, fin = _vence_en(db, office, 0.5)
    subscription.plan_id = _plan(db, "firm").id
    db.flush()
    _equipo(db, office, 11)
    llamadas = _cobro(monkeypatch, "APPROVED")

    resultado = renewals.attempt(db, _con_renovacion(settings), office.organization_id, fin, 1)

    assert resultado == "approved"
    assert llamadas[0]["amount_in_cents"] == (149_900 + 19_900) * 100
    comprobante = _comprobante(db, office)
    assert comprobante is not None
    assert comprobante.extra_users == 1


def test_el_aviso_de_renovacion_automatica_suma_los_adicionales(
    db: Session, settings: Settings
) -> None:
    from tests.test_renewals import _vence_en

    office = crear_oficina(db, "professional")
    subscription, fin = _vence_en(db, office, 7)
    subscription.plan_id = _plan(db, "professional").id
    db.flush()
    _equipo(db, office, 5)
    payload = {
        "organization_id": str(office.organization_id),
        "user_id": str(office.owner.id),
        "plan_code": "professional",
        "cycle": "monthly",
        "period_end": fin.isoformat(),
    }

    correo = payment_emails.reminder_email(db, payload, settings)

    assert correo is not None
    assert "$79.800 COP" in correo.text


# La API: el desglose antes de pagar y el aviso cuando el equipo no cabe.


def test_el_desglose_antes_de_pagar_muestra_cada_plan_para_el_equipo_de_hoy(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db, "trial")
    _en_prueba(db, office)
    _equipo(db, office, 5)
    cliente = _sesion(dispositivo, office.owner)

    respuesta = cliente.get("/api/v1/billing/quote")

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.headers["cache-control"] == "no-store"
    cuerpo = respuesta.json()
    assert cuerpo["users"] == 5
    opciones = {(o["plan_code"], o["billing_cycle"]): o for o in cuerpo["options"]}
    assert opciones[("essential", "monthly")]["fits"] is False
    profesional = opciones[("professional", "monthly")]
    assert profesional["fits"] is True
    assert profesional["extra_users"] == 1
    assert profesional["extra_user_unit_cop"] == 19_900
    assert profesional["total_cop"] == 59_900 + 19_900
    anual = opciones[("professional", "annual")]
    assert anual["extra_user_unit_cop"] == 199_000
    assert anual["total_cop"] == 599_000 + 199_000
    assert opciones[("firm", "monthly")]["extra_users"] == 0
    assert ("trial", "monthly") not in opciones


def test_solo_quien_administra_la_facturacion_ve_el_desglose(
    dispositivo: NuevoCliente, db: Session
) -> None:
    office = crear_oficina(db, "firm")
    abogado = crear_miembro(db, office, "abogado@example.com", "lawyer")

    assert _sesion(dispositivo, abogado).get("/api/v1/billing/quote").status_code == 403
    assert dispositivo().get("/api/v1/billing/quote").status_code == 401


def test_pagar_un_plan_donde_no_cabe_el_equipo_responde_409_con_la_explicacion(
    app: FastAPI, dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    office = crear_oficina(db, "trial")
    _en_prueba(db, office)
    _equipo(db, office, 5)
    cliente = _sesion(dispositivo, office.owner)
    app.dependency_overrides[get_app_settings] = lambda: _con_wompi(settings)

    respuesta = cliente.post(
        "/api/v1/billing/checkout-web", json={"plan_code": "essential", "billing_cycle": "monthly"}
    )

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"].startswith("Su equipo tiene 5 personas")


def test_la_renovacion_cobra_a_todo_el_equipo_aunque_pase_del_tope(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    # El tope de adicionales frena crecer, no cobrar a un equipo que ya existe: una firma con
    # 23 personas (3 por encima del tope de 20) renueva cobrando sus 13 adicionales y el pago
    # se activa con esa referencia (ADR-062).
    from tests.test_renewals import _vence_en

    office = crear_oficina(db, "firm")
    subscription, fin = _vence_en(db, office, 0.5)
    subscription.plan_id = _plan(db, "firm").id
    db.flush()
    _equipo(db, office, 23)
    llamadas = _cobro(monkeypatch, "APPROVED")

    resultado = renewals.attempt(db, _con_renovacion(settings), office.organization_id, fin, 1)

    assert resultado == "approved"
    assert llamadas[0]["amount_in_cents"] == (149_900 + 13 * 19_900) * 100
    comprobante = _comprobante(db, office)
    assert comprobante is not None
    assert comprobante.extra_users == 13


def test_comprar_un_plan_por_encima_del_tope_no_se_cobra(db: Session, settings: Settings) -> None:
    office = crear_oficina(db, "trial")
    _en_prueba(db, office)
    _equipo(db, office, 21)
    principal = _principal(office.organization_id, office.owner.id, "owner")

    with pytest.raises(checkout.EquipoNoCabeError) as error:
        checkout.iniciar_checkout_web(db, _con_wompi(settings), principal, "firm", "monthly")

    assert (error.value.users, error.value.limit) == (21, 20)
