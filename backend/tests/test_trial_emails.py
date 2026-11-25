"""Correos del ciclo de la prueba: cuándo sale cada uno, a quién, y que nunca salga dos veces."""

import datetime
import uuid

import pytest
from sqlalchemy import Engine, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.tenancy import TenantContext, set_tenant
from app.models import Job, Organization, Subscription, TrialEmail
from app.services import notifications, trial_emails
from app.worker.handlers import HANDLERS, WorkerContext
from app.worker.runner import Worker
from tests.organizations import Oficina, crear_oficina
from tests.test_worker import FakeEmailSender

BOGOTA = trial_emails.BOGOTA


def _en_prueba(db: Session, *, verificado: bool = True) -> tuple[Oficina, datetime.datetime]:
    """Un despacho que acaba de abrir su prueba de catorce días, con el correo verificado."""
    office = crear_oficina(db, "trial")
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    started = db.scalars(
        select(Organization.created_at).where(Organization.id == office.organization_id)
    ).one()
    subscription = db.scalars(
        select(Subscription).where(Subscription.organization_id == office.organization_id)
    ).one()
    subscription.status = "trial"
    subscription.access_source = "trial"
    subscription.billing_cycle = "none"
    subscription.trial_ends_at = started + datetime.timedelta(days=14)
    if verificado:
        office.owner.email_verified_at = started
    db.flush()
    set_tenant(db, TenantContext())
    return office, started


def _correos(db: Session, office: Oficina) -> list[str]:
    return [
        job.payload["stage"]
        for job in db.scalars(select(Job).where(Job.kind == "email_send").order_by(Job.id))
        if job.payload.get("template") == trial_emails.TEMPLATE
        and job.payload.get("organization_id") == str(office.organization_id)
    ]


def _anotadas(db: Session, office: Oficina) -> dict[str, bool]:
    set_tenant(db, TenantContext(office.organization_id))
    rows = db.scalars(
        select(TrialEmail).where(TrialEmail.organization_id == office.organization_id)
    ).all()
    return {row.stage: row.emailed for row in rows}


def test_las_horas_son_las_de_bogota() -> None:
    # Empieza a las 10 de la noche de Bogotá: la bienvenida espera a las 8 de la mañana.
    started = datetime.datetime(2026, 11, 24, 22, 0, tzinfo=BOGOTA)
    ends = started + datetime.timedelta(days=14)

    assert trial_emails.due_at("day_0", started, ends) == datetime.datetime(
        2026, 11, 25, 8, 0, tzinfo=BOGOTA
    )
    assert trial_emails.due_at("day_3", started, ends) == datetime.datetime(
        2026, 11, 27, 9, 0, tzinfo=BOGOTA
    )
    assert trial_emails.due_at("day_7", started, ends) == datetime.datetime(
        2026, 12, 1, 9, 0, tzinfo=BOGOTA
    )
    assert trial_emails.due_at("day_11", started, ends) == datetime.datetime(
        2026, 12, 5, 9, 0, tzinfo=BOGOTA
    )
    assert trial_emails.due_at("day_14", started, ends) == datetime.datetime(
        2026, 12, 9, 8, 0, tzinfo=BOGOTA
    )


def test_de_dia_la_bienvenida_sale_enseguida() -> None:
    started = datetime.datetime(2026, 11, 24, 15, 30, tzinfo=BOGOTA)

    assert trial_emails.due_at("day_0", started, started) == started


def test_al_terminar_la_prueba_solo_queda_el_cierre() -> None:
    started = datetime.datetime(2026, 11, 1, 12, 0, tzinfo=BOGOTA)
    candidate = trial_emails.Candidate(
        organization_id=uuid.uuid7(),
        owner_id=uuid.uuid7(),
        started_at=started,
        trial_ends_at=started + datetime.timedelta(days=14),
        sent=frozenset({"day_0"}),
    )

    durante = trial_emails.due_stages(candidate, started + datetime.timedelta(days=8))
    despues = trial_emails.due_stages(candidate, started + datetime.timedelta(days=14, hours=1))

    assert durante == ["day_3", "day_7"]
    assert despues == ["day_14"]


def test_la_bienvenida_sale_una_sola_vez(db: Session) -> None:
    office, started = _en_prueba(db)
    manana = started + datetime.timedelta(days=1)

    trial_emails.dispatch(db, manana)
    trial_emails.dispatch(db, manana)

    assert _correos(db, office) == ["day_0"]
    assert _anotadas(db, office) == {"day_0": True}


def test_cada_etapa_sale_en_su_dia(db: Session) -> None:
    office, started = _en_prueba(db)

    for dias in (1, 4, 8, 12, 15):
        trial_emails.dispatch(db, started + datetime.timedelta(days=dias))

    assert _correos(db, office) == ["day_0", "day_3", "day_7", "day_11", "day_14"]


def test_si_se_acumulan_etapas_solo_sale_la_mas_reciente(db: Session) -> None:
    office, started = _en_prueba(db)

    trial_emails.dispatch(db, started + datetime.timedelta(days=8))

    assert _correos(db, office) == ["day_7"]
    assert _anotadas(db, office) == {"day_0": False, "day_3": False, "day_7": True}


def test_sin_correo_verificado_no_sale_nada(db: Session) -> None:
    office, started = _en_prueba(db, verificado=False)

    trial_emails.dispatch(db, started + datetime.timedelta(days=1))

    assert _correos(db, office) == []


def test_un_despacho_que_ya_paga_no_recibe_los_correos(db: Session) -> None:
    office, started = _en_prueba(db)
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = db.scalars(
        select(Subscription).where(Subscription.organization_id == office.organization_id)
    ).one()
    subscription.status = "active"
    subscription.access_source = "payment"
    subscription.billing_cycle = "monthly"
    db.flush()

    trial_emails.dispatch(db, started + datetime.timedelta(days=1))

    assert _correos(db, office) == []


def _correo(db: Session, office: Oficina, stage: str, settings: Settings) -> object:
    payload = {
        "template": trial_emails.TEMPLATE,
        "organization_id": str(office.organization_id),
        "user_id": str(office.owner.id),
        "stage": stage,
    }
    return notifications.build_email(db, payload, settings)


def test_cada_correo_dice_lo_suyo_y_lleva_su_enlace(db: Session, settings: Settings) -> None:
    office, _ = _en_prueba(db)
    esperado = {
        "day_0": ("abra su primer caso", "/app/casos/nuevo"),
        "day_3": ("sello de tiempo RFC 3161", "/app/casos"),
        "day_7": ("Su prueba incluye 3 usuarios: usted y otras 2 personas", "/app/miembros"),
        "day_11": ("solo lectura durante 30 días", "/app/facturacion"),
    }

    for stage, (frase, ruta) in esperado.items():
        correo = _correo(db, office, stage, settings)
        assert correo is not None, stage
        texto = correo.text  # type: ignore[attr-defined]
        assert frase.lower() in texto.lower(), stage
        assert f"{settings.public_url}{ruta}" in texto, stage
        assert correo.to == office.owner.email  # type: ignore[attr-defined]
        for prohibido in ("—", "…", "·"):
            assert prohibido not in texto, (stage, prohibido)


def test_el_aviso_del_dia_11_nombra_la_fecha_en_el_asunto(db: Session, settings: Settings) -> None:
    office, started = _en_prueba(db)
    fin = started + datetime.timedelta(days=14)

    correo = _correo(db, office, "day_11", settings)

    assert correo is not None
    assert trial_emails.colombian_date(fin) in correo.subject  # type: ignore[attr-defined]


def test_el_cierre_solo_sale_con_la_prueba_terminada_o_vencida(
    db: Session, settings: Settings
) -> None:
    office, _ = _en_prueba(db)
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = db.scalars(
        select(Subscription).where(Subscription.organization_id == office.organization_id)
    ).one()
    subscription.status = "expired"
    db.flush()

    cierre = _correo(db, office, "day_14", settings)
    aviso = _correo(db, office, "day_11", settings)

    assert cierre is not None
    assert "30 días en solo lectura" in cierre.text  # type: ignore[attr-defined]
    assert aviso is None


def test_si_paga_antes_de_que_salga_el_correo_ya_no_sale(db: Session, settings: Settings) -> None:
    office, _ = _en_prueba(db)
    set_tenant(db, TenantContext(office.organization_id, office.owner.id))
    subscription = db.scalars(
        select(Subscription).where(Subscription.organization_id == office.organization_id)
    ).one()
    subscription.status = "active"
    subscription.access_source = "payment"
    db.flush()

    assert _correo(db, office, "day_7", settings) is None


def test_el_trabajador_conoce_la_plantilla() -> None:
    assert trial_emails.TEMPLATE in notifications.EMAIL_BUILDERS
    assert "email_send" in HANDLERS


def test_el_mantenimiento_del_trabajador_revisa_los_correos_de_la_prueba(
    app_engine: Engine, migrated_database: None, monkeypatch: pytest.MonkeyPatch, settings: Settings
) -> None:
    del migrated_database
    llamadas: list[datetime.datetime] = []

    def revisar(_session: Session, now: datetime.datetime) -> int:
        llamadas.append(now)
        return 0

    monkeypatch.setattr(trial_emails, "dispatch", revisar)
    worker = Worker(app_engine, WorkerContext(email=FakeEmailSender(), settings=settings))

    worker.maintain_if_due()

    assert len(llamadas) == 1


def test_si_falla_la_revision_el_mantenimiento_no_se_cae(
    app_engine: Engine,
    migrated_database: None,
    monkeypatch: pytest.MonkeyPatch,
    settings: Settings,
    caplog: pytest.LogCaptureFixture,
) -> None:
    del migrated_database

    def falla(_session: Session, _now: datetime.datetime) -> int:
        raise OperationalError("SELECT", {}, Exception("sin base"))

    monkeypatch.setattr(trial_emails, "dispatch", falla)
    worker = Worker(app_engine, WorkerContext(email=FakeEmailSender(), settings=settings))

    worker.maintain_if_due()

    assert "No se pudieron revisar los correos de la prueba" in caplog.text
