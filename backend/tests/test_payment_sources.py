"""Vincular y cancelar la fuente de pago de la renovación automática (ADR-058, primera etapa)."""

import datetime

import pytest
from pydantic import Secret
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters import wompi
from app.core.config import Settings
from app.core.legal import LEGAL_VERSION
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, PaymentSource
from app.services import payment_sources as sources
from app.services.sessions import Principal
from tests.organizations import Oficina, crear_miembro, crear_oficina

_TELEFONO = "3001234567"


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


def _principal(office: Oficina, user_id: object, role: str = "owner") -> Principal:
    import uuid

    assert isinstance(user_id, uuid.UUID)
    return Principal(
        user_id=user_id,
        session_id=uuid.uuid7(),
        organization_id=office.organization_id,
        role=role,
        legal_version=LEGAL_VERSION,
    )


def _wompi_simulado(monkeypatch: pytest.MonkeyPatch, *, estado: str = "APPROVED") -> list[str]:
    llamadas: list[str] = []

    def crear_token(_creds: object, telefono: str) -> str:
        llamadas.append(f"token:{telefono}")
        return "nequi_test_ABC123"

    def consultar(_creds: object, token: str) -> str:
        llamadas.append(f"consulta:{token}")
        return estado

    def crear_fuente(_creds: object, **kwargs: object) -> int:
        llamadas.append(f"fuente:{kwargs['token']}")
        return 3891

    monkeypatch.setattr(wompi, "crear_token_nequi", crear_token)
    monkeypatch.setattr(wompi, "consultar_token_nequi", consultar)
    monkeypatch.setattr(wompi, "crear_fuente_nequi", crear_fuente)
    return llamadas


def _iniciar(db: Session, settings: Settings, office: Oficina, *, version: str | None = None):  # type: ignore[no-untyped-def]
    return sources.start(
        db,
        settings,
        _principal(office, office.owner.id),
        phone_number=_TELEFONO,
        consent_version=version or sources.CONSENT_VERSION,
        client_ip="203.0.113.7",
        user_agent="prueba",
    )


def _confirmar(db: Session, settings: Settings, office: Oficina):  # type: ignore[no-untyped-def]
    return sources.confirm(
        db,
        settings,
        _principal(office, office.owner.id),
        acceptance_token="acc",  # noqa: S106
        accept_personal_auth="auth",
        client_ip="203.0.113.7",
        user_agent="prueba",
    )


def _filas(db: Session, office: Oficina) -> list[PaymentSource]:
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    return list(db.scalars(select(PaymentSource)))


def test_apagada_la_renovacion_no_se_puede_vincular(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    llamadas = _wompi_simulado(monkeypatch)

    with pytest.raises(sources.RecurringUnavailableError):
        _iniciar(db, _con_wompi(settings, encendida=False), office)

    assert llamadas == []
    assert _filas(db, office) == []


def test_vincular_guarda_el_consentimiento_y_queda_en_tramite_hasta_que_se_apruebe(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    llamadas = _wompi_simulado(monkeypatch, estado="PENDING")
    con_wompi = _con_wompi(settings)

    vista = _iniciar(db, con_wompi, office)
    aun = _confirmar(db, con_wompi, office)

    assert vista.status == "pending"
    assert vista.phone_last4 == "4567"
    assert aun.status == "pending"
    (fila,) = _filas(db, office)
    assert fila.consent_version == sources.CONSENT_VERSION
    assert fila.consent_ip == "203.0.113.7"
    assert fila.gateway_source_id is None
    # Nunca se guarda el número completo.
    assert _TELEFONO not in repr(fila.__dict__)
    assert not any(llamada.startswith("fuente") for llamada in llamadas)


def test_al_aprobar_en_el_celular_se_crea_la_fuente_y_queda_auditada(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _wompi_simulado(monkeypatch)
    con_wompi = _con_wompi(settings)
    _iniciar(db, con_wompi, office)

    vista = _confirmar(db, con_wompi, office)

    assert vista.status == "active"
    (fila,) = _filas(db, office)
    assert fila.status == "active"
    assert fila.gateway_source_id == 3891
    assert fila.linked_at is not None
    evento = db.scalars(select(AuditLog).where(AuditLog.action == "payment_source_linked")).one()
    assert evento.details == {"medio": "nequi", "terminacion": "4567"}


def test_si_la_persona_rechaza_en_el_celular_la_fuente_queda_declinada_y_se_puede_reintentar(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _wompi_simulado(monkeypatch, estado="DECLINED")
    con_wompi = _con_wompi(settings)
    _iniciar(db, con_wompi, office)

    assert _confirmar(db, con_wompi, office).status == "declined"

    # La declinada ya no ocupa el lugar de la fuente viva: se puede volver a intentar.
    assert _iniciar(db, con_wompi, office).status == "pending"


def test_una_sola_fuente_viva_por_despacho(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _wompi_simulado(monkeypatch)
    con_wompi = _con_wompi(settings)
    _iniciar(db, con_wompi, office)

    with pytest.raises(sources.AlreadyLinkedError):
        _iniciar(db, con_wompi, office)


def test_un_texto_de_consentimiento_distinto_al_vigente_se_rechaza(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    llamadas = _wompi_simulado(monkeypatch)

    with pytest.raises(sources.ConsentMismatchError):
        _iniciar(db, _con_wompi(settings), office, version="2020-01-01")

    assert llamadas == []


def test_solo_quien_administra_la_facturacion_vincula(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db, "firm")
    abogada = crear_miembro(db, office, "abogada@example.com", "lawyer")
    llamadas = _wompi_simulado(monkeypatch)

    with pytest.raises(sources.NotAllowedError):
        sources.start(
            db,
            _con_wompi(settings),
            _principal(office, abogada.id, "lawyer"),
            phone_number=_TELEFONO,
            consent_version=sources.CONSENT_VERSION,
            client_ip="203.0.113.7",
            user_agent=None,
        )

    assert llamadas == []


def test_cancelar_es_inmediato_deja_constancia_y_libera_el_cupo(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    _wompi_simulado(monkeypatch)
    con_wompi = _con_wompi(settings)
    _iniciar(db, con_wompi, office)
    _confirmar(db, con_wompi, office)

    hubo = sources.cancel(
        db,
        con_wompi,
        _principal(office, office.owner.id),
        client_ip="203.0.113.7",
        user_agent=None,
    )

    assert hubo is True
    (fila,) = _filas(db, office)
    assert fila.status == "canceled"
    assert fila.canceled_at is not None
    assert fila.canceled_by == office.owner.id
    assert db.scalars(select(AuditLog).where(AuditLog.action == "payment_source_canceled")).one()
    # Ya no hay una fuente viva, y se puede vincular otra.
    assert sources.current(db, con_wompi, _principal(office, office.owner.id)) is None
    assert _iniciar(db, con_wompi, office).status == "pending"


def test_el_numero_de_celular_se_valida_antes_de_llamar_a_wompi(
    db: Session, settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    office = crear_oficina(db)
    llamadas = _wompi_simulado(monkeypatch)

    with pytest.raises(sources.InvalidPhoneError):
        sources.start(
            db,
            _con_wompi(settings),
            _principal(office, office.owner.id),
            phone_number="12345",
            consent_version=sources.CONSENT_VERSION,
            client_ip="203.0.113.7",
            user_agent=None,
        )

    assert llamadas == []


@pytest.mark.parametrize("token", ["../merchants/info", "tok/1", "tok?x=1", "", "a" * 101])
def test_un_token_que_no_es_de_wompi_nunca_llega_a_la_url(
    token: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    llamadas: list[str] = []

    def falsa(url: str, **_kw: object) -> dict[str, object]:
        llamadas.append(url)
        return {}

    monkeypatch.setattr(wompi, "_llamar", falsa)
    creds = wompi.Credenciales(
        public_key="pub_test_x",
        private_key="prv_test_x",
        integrity_secret="test_integrity_x",  # noqa: S106
        events_secret="test_events_x",  # noqa: S106
        base_url="https://sandbox.wompi.co/v1",
    )

    with pytest.raises(wompi.WompiRechazadoError):
        wompi.consultar_token_nequi(creds, token)

    assert llamadas == []


def test_el_consentimiento_vigente_dice_lo_que_se_cobra_y_como_cancelar() -> None:
    texto = sources.CONSENT_TEXT
    for frase in ("cobrar", "siete días", "cancelar"):
        assert frase in texto
    assert datetime.date.fromisoformat(sources.CONSENT_VERSION)
