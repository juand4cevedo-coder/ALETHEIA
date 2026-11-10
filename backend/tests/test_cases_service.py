"""Pruebas del servicio de casos: abrir un caso y ver su detalle (HU-015, CA-HU-015-01 y
CA-HU-015-02)."""

import datetime
import uuid
from pathlib import Path

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.adapters.keys import KeyWrapperError, LocalKeyWrapper, WrappedKey
from app.core.case_keys import open_case_key
from app.core.legal import LEGAL_VERSION
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Case, CaseMember, CustodyEvent, Organization, User
from app.services import custody_chain
from app.services.cases import (
    CaseNotFoundError,
    EmailNotVerifiedError,
    FilingNumberTakenError,
    NewCase,
    NotAllowedToCreateCasesError,
    create_case,
    get_case,
)
from app.services.members import OrganizationNotActiveError
from app.services.sessions import Principal
from tests.organizations import Oficina, crear_miembro, crear_oficina

_IP = "203.0.113.7"
_AGENTE = "Mozilla/5.0 (prueba)"
_RADICADO = "11001310500320260014300"


class EnvoltorioDePrueba:
    """Envuelve con la llave local, cuenta las llamadas y anota si había una transacción."""

    def __init__(self, real: LocalKeyWrapper, session: Session, *, falla: bool = False) -> None:
        self._real = real
        self._session = session
        self._falla = falla
        self.llamadas = 0
        self.con_transaccion: list[bool] = []
        self.ultima: WrappedKey | None = None

    def wrap(self, plaintext: bytes) -> WrappedKey:
        self.llamadas += 1
        self.con_transaccion.append(self._session.in_transaction())
        if self._falla:
            msg = "KMS no respondió"
            raise KeyWrapperError(msg)
        self.ultima = self._real.wrap(plaintext)
        return self.ultima

    def unwrap(self, wrapped: WrappedKey) -> bytes:
        return self._real.unwrap(wrapped)


@pytest.fixture(scope="module")
def llave_local(local_key_path: Path) -> LocalKeyWrapper:
    return LocalKeyWrapper.from_pem_file(local_key_path)


@pytest.fixture
def envoltorio(llave_local: LocalKeyWrapper, db: Session) -> EnvoltorioDePrueba:
    return EnvoltorioDePrueba(llave_local, db)


def _principal(oficina: Oficina | None, user: User, role: str | None) -> Principal:
    return Principal(
        user_id=user.id,
        session_id=uuid.uuid7(),
        organization_id=oficina.organization_id if oficina else None,
        role=role,
        legal_version=LEGAL_VERSION,
    )


def _verificar(db: Session, user: User) -> None:
    db.execute(
        update(User)
        .where(User.id == user.id)
        .values(email_verified_at=datetime.datetime.now(datetime.UTC))
    )
    db.flush()


def _persona(db: Session, oficina: Oficina, role: str) -> User:
    if role == "owner":
        user = oficina.owner
    else:
        user = crear_miembro(db, oficina, f"{role}-{uuid.uuid4().hex[:8]}@example.com", role)
    _verificar(db, user)
    return user


def _datos(**cambios: str | None) -> NewCase:
    datos: dict[str, str | None] = {
        "title": "Despido de María Pérez",
        "filing_number": None,
        "court": None,
        "practice_area": None,
        "internal_reference": None,
    }
    return NewCase(**(datos | cambios))  # type: ignore[arg-type]


def _abrir(
    db: Session, principal: Principal, envoltorio: EnvoltorioDePrueba, **cambios: str | None
) -> Case:
    return create_case(
        db, principal, _datos(**cambios), envoltorio, client_ip=_IP, user_agent=_AGENTE
    )


def _contexto(db: Session, oficina: Oficina) -> None:
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=oficina.owner.id))


def _filas(db: Session, oficina: Oficina) -> dict[str, int]:
    _contexto(db, oficina)
    organizacion = oficina.organization_id
    return {
        "cases": db.scalar(
            select(func.count()).select_from(Case).where(Case.organization_id == organizacion)
        )
        or 0,
        "case_members": db.scalar(
            select(func.count())
            .select_from(CaseMember)
            .where(CaseMember.organization_id == organizacion)
        )
        or 0,
        "custody_events": db.scalar(
            select(func.count())
            .select_from(CustodyEvent)
            .where(CustodyEvent.organization_id == organizacion)
        )
        or 0,
        "audit_log": db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.organization_id == organizacion, AuditLog.action == "case_created")
        )
        or 0,
    }


# --- Quién abre casos (RN-008, CA-HU-015-02) ------------------------------------------------


@pytest.mark.parametrize("role", ["owner", "admin", "lawyer"])
def test_propietario_administrador_y_abogado_abren_casos(
    db: Session, envoltorio: EnvoltorioDePrueba, role: str
) -> None:
    oficina = crear_oficina(db)
    persona = _persona(db, oficina, role)

    caso = _abrir(
        db,
        _principal(oficina, persona, role),
        envoltorio,
        filing_number=_RADICADO,
        court="Juzgado 3 Laboral del Circuito de Bogotá",
        practice_area="labor",
        internal_reference="EXP-2026-014",
    )

    assert caso.organization_id == oficina.organization_id
    assert caso.title == "Despido de María Pérez"
    assert caso.filing_number == _RADICADO
    assert caso.court == "Juzgado 3 Laboral del Circuito de Bogotá"
    assert caso.practice_area == "labor"
    assert caso.internal_reference == "EXP-2026-014"
    assert caso.status == "open"
    assert caso.created_by == persona.id
    assert envoltorio.ultima is not None
    assert caso.wrapped_key == envoltorio.ultima.ciphertext
    assert caso.key_version == envoltorio.ultima.key_version
    # La llave guardada se recupera con la llave maestra.
    open_case_key(envoltorio, WrappedKey(caso.wrapped_key, caso.key_version))


def test_el_asistente_no_abre_casos(db: Session, envoltorio: EnvoltorioDePrueba) -> None:
    oficina = crear_oficina(db)
    asistente = _persona(db, oficina, "assistant")

    with pytest.raises(NotAllowedToCreateCasesError):
        _abrir(db, _principal(oficina, asistente, "assistant"), envoltorio)

    assert envoltorio.llamadas == 0
    assert _filas(db, oficina)["cases"] == 0


def test_sin_organizacion_no_abre_casos(db: Session, envoltorio: EnvoltorioDePrueba) -> None:
    oficina = crear_oficina(db)
    _verificar(db, oficina.owner)

    with pytest.raises(NotAllowedToCreateCasesError):
        _abrir(db, _principal(None, oficina.owner, None), envoltorio)

    assert envoltorio.llamadas == 0


def test_con_el_correo_sin_verificar_no_abre_casos(
    db: Session, envoltorio: EnvoltorioDePrueba
) -> None:
    oficina = crear_oficina(db)

    with pytest.raises(EmailNotVerifiedError):
        _abrir(db, _principal(oficina, oficina.owner, "owner"), envoltorio)

    assert envoltorio.llamadas == 0
    assert _filas(db, oficina)["cases"] == 0


def test_en_solo_lectura_no_abre_casos(db: Session, envoltorio: EnvoltorioDePrueba) -> None:
    oficina = crear_oficina(db)
    propietario = _persona(db, oficina, "owner")
    _contexto(db, oficina)
    db.execute(
        update(Organization)
        .where(Organization.id == oficina.organization_id)
        .values(status="read_only")
    )
    db.flush()

    with pytest.raises(OrganizationNotActiveError):
        _abrir(db, _principal(oficina, propietario, "owner"), envoltorio)

    assert envoltorio.llamadas == 0
    assert _filas(db, oficina)["cases"] == 0


# --- Lo que deja abrir un caso (CA-HU-015-01) -----------------------------------------------


def test_quien_abre_queda_como_miembro_y_comienza_la_cadena(
    db: Session, envoltorio: EnvoltorioDePrueba
) -> None:
    oficina = crear_oficina(db)
    abogado = _persona(db, oficina, "lawyer")

    caso = _abrir(db, _principal(oficina, abogado, "lawyer"), envoltorio, filing_number=_RADICADO)

    _contexto(db, oficina)
    (miembro,) = db.scalars(select(CaseMember).where(CaseMember.case_id == caso.id))
    assert miembro.user_id == abogado.id
    assert miembro.added_by == abogado.id
    assert miembro.organization_id == oficina.organization_id
    (evento,) = db.scalars(select(CustodyEvent).where(CustodyEvent.case_id == caso.id))
    assert evento.seq == 1
    assert evento.action == "case_created"
    assert evento.actor_user_id == abogado.id
    assert evento.evidence_id is None
    assert envoltorio.ultima is not None
    # Ni el título ni los datos procesales entran en la cadena (sección 3.2).
    assert evento.details == {"key_version": envoltorio.ultima.key_version}
    assert evento.prev_hash == custody_chain.GENESIS_HASH
    db.refresh(caso)
    assert caso.custody_seq == 1
    informe = custody_chain.verify(custody_chain.load(db, caso.id))
    assert informe.intact
    assert informe.events_checked == 1
    assert informe.head_hash == evento.event_hash


def test_queda_un_registro_de_auditoria(db: Session, envoltorio: EnvoltorioDePrueba) -> None:
    oficina = crear_oficina(db)
    propietario = _persona(db, oficina, "owner")

    caso = _abrir(db, _principal(oficina, propietario, "owner"), envoltorio)

    _contexto(db, oficina)
    (registro,) = db.scalars(
        select(AuditLog).where(
            AuditLog.organization_id == oficina.organization_id,
            AuditLog.action == "case_created",
        )
    )
    assert registro.target_id == caso.id
    assert registro.actor_user_id == propietario.id
    assert str(registro.ip) == _IP
    assert registro.user_agent == _AGENTE


def test_si_kms_falla_no_queda_nada(llave_local: LocalKeyWrapper, db: Session) -> None:
    oficina = crear_oficina(db)
    propietario = _persona(db, oficina, "owner")
    falla = EnvoltorioDePrueba(llave_local, db, falla=True)

    with pytest.raises(KeyWrapperError):
        _abrir(db, _principal(oficina, propietario, "owner"), falla)

    assert falla.llamadas == 1
    assert _filas(db, oficina) == {
        "cases": 0,
        "case_members": 0,
        "custody_events": 0,
        "audit_log": 0,
    }


def test_kms_se_llama_sin_transaccion_abierta(db: Session, envoltorio: EnvoltorioDePrueba) -> None:
    oficina = crear_oficina(db)
    propietario = _persona(db, oficina, "owner")

    _abrir(db, _principal(oficina, propietario, "owner"), envoltorio)

    assert envoltorio.con_transaccion == [False]


def test_el_radicado_repetido_es_un_error_propio(
    db: Session, envoltorio: EnvoltorioDePrueba
) -> None:
    oficina = crear_oficina(db)
    propietario = _persona(db, oficina, "owner")
    principal = _principal(oficina, propietario, "owner")
    primero = _abrir(db, principal, envoltorio, filing_number=_RADICADO)

    with pytest.raises(FilingNumberTakenError):
        _abrir(db, principal, envoltorio, title="Otro caso", filing_number=_RADICADO)

    # El primero sigue y el segundo no dejó nada.
    assert _filas(db, oficina) == {
        "cases": 1,
        "case_members": 1,
        "custody_events": 1,
        "audit_log": 1,
    }
    assert get_case(db, principal, primero.id).case.id == primero.id


def test_el_mismo_radicado_en_otra_organizacion_no_choca(
    db: Session, envoltorio: EnvoltorioDePrueba
) -> None:
    una = crear_oficina(db)
    otra = crear_oficina(db, nombre="Gómez")
    _abrir(
        db,
        _principal(una, _persona(db, una, "owner"), "owner"),
        envoltorio,
        filing_number=_RADICADO,
    )

    caso = _abrir(
        db,
        _principal(otra, _persona(db, otra, "owner"), "owner"),
        envoltorio,
        filing_number=_RADICADO,
    )

    assert caso.organization_id == otra.organization_id


# --- Detalle del caso (MSG-011) --------------------------------------------------------------


def test_un_caso_ajeno_no_se_encuentra(db: Session, envoltorio: EnvoltorioDePrueba) -> None:
    oficina = crear_oficina(db)
    propietario = _persona(db, oficina, "owner")
    caso_id = _abrir(db, _principal(oficina, propietario, "owner"), envoltorio).id
    ajena = crear_oficina(db, nombre="Gómez")
    companero = _persona(db, oficina, "lawyer")

    with pytest.raises(CaseNotFoundError):
        get_case(db, _principal(ajena, ajena.owner, "owner"), caso_id)
    with pytest.raises(CaseNotFoundError):
        get_case(db, _principal(oficina, companero, "lawyer"), caso_id)
    with pytest.raises(CaseNotFoundError):
        get_case(db, _principal(None, propietario, None), caso_id)
    with pytest.raises(CaseNotFoundError):
        get_case(db, _principal(oficina, propietario, "owner"), uuid.uuid7())


def test_el_detalle_trae_el_equipo_y_el_primer_evento(
    db: Session, envoltorio: EnvoltorioDePrueba
) -> None:
    oficina = crear_oficina(db)
    abogado = _persona(db, oficina, "lawyer")
    principal = _principal(oficina, abogado, "lawyer")
    caso = _abrir(db, principal, envoltorio)

    detalle = get_case(db, principal, caso.id)

    assert detalle.case.id == caso.id
    assert detalle.case.title == "Despido de María Pérez"
    (miembro,) = detalle.members
    assert miembro.user_id == abogado.id
    assert miembro.full_name == abogado.full_name
    assert miembro.email == abogado.email
    assert miembro.role == "lawyer"
    assert miembro.added_at is not None
    (evento,) = detalle.recent_events
    assert evento.seq == 1
    assert evento.action == "case_created"
    assert evento.actor_name == abogado.full_name
    assert evento.occurred_at is not None
    assert len(evento.event_hash) == 32
