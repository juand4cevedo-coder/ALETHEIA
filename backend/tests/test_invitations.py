"""Pruebas de los miembros y las invitaciones (HU-011, CA-HU-011-01 a CA-HU-011-03, CP-011)."""

import datetime
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.core.config import Settings
from app.core.legal import LEGAL_VERSION
from app.core.passwords import hash_password
from app.core.tokens import opaque_token_hash
from app.db.tenancy import TenantContext, set_tenant
from app.main import create_app
from app.models import AuditLog, Invitation, Job, Membership, Organization, Plan, Subscription, User
from app.services import notifications
from app.services import organization_emails as _organization_emails  # noqa: F401
from app.services.members import INVITATION_LIFETIME, INVITATION_TEMPLATE
from app.services.organization_emails import colombian_datetime
from tests.conftest import SAME_ORIGIN_HEADERS

_INGRESO = "/api/v1/auth/login"
_INVITACIONES = "/api/v1/organization/invitations"
_MIEMBROS = "/api/v1/organization/members"
_CLAVE = "una frase larga y fácil de recordar"
_HASH = hash_password(_CLAVE)

type NuevoCliente = Callable[[], TestClient]


@pytest.fixture
def app(settings: Settings, db: Session) -> FastAPI:
    application = create_app(settings)
    application.dependency_overrides[get_session] = lambda: db
    return application


@pytest.fixture
def dispositivo(app: FastAPI) -> Iterator[NuevoCliente]:
    abiertos: list[TestClient] = []

    def nuevo() -> TestClient:
        cliente = TestClient(app, base_url="https://testserver", headers=SAME_ORIGIN_HEADERS)
        cliente.__enter__()
        abiertos.append(cliente)
        return cliente

    yield nuevo
    for cliente in abiertos:
        cliente.__exit__(None, None, None)


@dataclass(frozen=True, slots=True)
class Oficina:
    """Una organización de prueba con su propietario."""

    organization_id: uuid.UUID
    owner: User


def _oficina(db: Session, plan: str = "professional", *, nombre: str = "Restrepo") -> Oficina:
    owner = _persona(db, f"propietario-{uuid.uuid4().hex[:8]}@example.com", f"Ana {nombre}")
    organization_id = uuid.uuid7()
    set_tenant(db, TenantContext(organization_id=organization_id, user_id=owner.id))
    db.add(Organization(id=organization_id, name=f"{nombre} Abogados"))
    db.flush()
    plan_id = db.scalar(select(Plan.id).where(Plan.code == plan))
    assert plan_id is not None
    db.add_all(
        [
            Membership(organization_id=organization_id, user_id=owner.id, role="owner"),
            Subscription(
                organization_id=organization_id,
                plan_id=plan_id,
                status="active",
                billing_cycle="monthly",
            ),
        ]
    )
    db.flush()
    set_tenant(db, TenantContext())
    return Oficina(organization_id=organization_id, owner=owner)


def _persona(db: Session, email: str, nombre: str = "Carlos Gómez") -> User:
    user = User(
        email=email,
        password_hash=_HASH,
        full_name=nombre,
        terms_version=LEGAL_VERSION,
        privacy_version=LEGAL_VERSION,
        consented_at=datetime.datetime.now(datetime.UTC),
    )
    db.add(user)
    db.flush()
    return user


def _miembro(db: Session, oficina: Oficina, email: str, role: str) -> User:
    user = _persona(db, email)
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=user.id))
    db.add(Membership(organization_id=oficina.organization_id, user_id=user.id, role=role))
    db.flush()
    set_tenant(db, TenantContext())
    return user


def _sesion(dispositivo: NuevoCliente, user: User) -> TestClient:
    cliente = dispositivo()
    respuesta = cliente.post(_INGRESO, json={"email": user.email, "password": _CLAVE})
    assert respuesta.status_code == 204, respuesta.text
    return cliente


def _invitar(cliente: TestClient, email: str, role: str = "lawyer") -> Any:
    return cliente.post(_INVITACIONES, json={"email": email, "role": role})


def _contexto(db: Session, oficina: Oficina) -> None:
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=oficina.owner.id))


def _invitaciones(db: Session, oficina: Oficina) -> list[Invitation]:
    _contexto(db, oficina)
    statement = select(Invitation).execution_options(populate_existing=True)
    return list(db.scalars(statement))


def _auditoria(db: Session, oficina: Oficina, action: str) -> list[AuditLog]:
    _contexto(db, oficina)
    return list(db.scalars(select(AuditLog).where(AuditLog.action == action)))


def _tareas(db: Session) -> list[dict[str, Any]]:
    statement = select(Job).where(Job.kind == "email_send")
    return [job.payload for job in db.scalars(statement) if job.payload["template"] == "invitation"]


def _vencer(db: Session, oficina: Oficina, invitation_id: uuid.UUID) -> None:
    _contexto(db, oficina)
    db.execute(
        update(Invitation)
        .where(Invitation.id == invitation_id)
        .values(expires_at=datetime.datetime.now(datetime.UTC) - datetime.timedelta(minutes=1))
    )
    db.flush()


# --- Invitar (API-016, CA-HU-011-01) -------------------------------------------------------


def test_el_propietario_invita_con_un_rol_y_sale_el_correo(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = _oficina(db)
    cliente = _sesion(dispositivo, oficina.owner)

    respuesta = _invitar(cliente, "  Carlos@Example.com ", "assistant")

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.headers["cache-control"] == "no-store"
    cuerpo = respuesta.json()
    assert cuerpo["email"] == "carlos@example.com"
    assert cuerpo["role"] == "assistant"
    assert cuerpo["expired"] is False
    vence = datetime.datetime.fromisoformat(cuerpo["expires_at"])
    enviada = datetime.datetime.fromisoformat(cuerpo["invited_at"])
    assert vence - enviada == INVITATION_LIFETIME

    [invitacion] = _invitaciones(db, oficina)
    assert invitacion.invited_by == oficina.owner.id
    [evento] = _auditoria(db, oficina, "invitation_sent")
    assert evento.actor_user_id == oficina.owner.id
    assert evento.target_id == invitacion.id
    # La tarea guarda solo identificadores: ni el correo, ni el token.
    assert _tareas(db) == [
        {
            "template": INVITATION_TEMPLATE,
            "invitation_id": str(invitacion.id),
            "organization_id": str(oficina.organization_id),
        }
    ]


def test_el_administrador_tambien_invita(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = _oficina(db, "firm")
    admin = _miembro(db, oficina, "admin@example.com", "admin")

    respuesta = _invitar(_sesion(dispositivo, admin), "nuevo@example.com", "admin")

    assert respuesta.status_code == 201, respuesta.text


@pytest.mark.parametrize("role", ["lawyer", "assistant"])
def test_un_abogado_o_un_asistente_no_puede_invitar(
    dispositivo: NuevoCliente, db: Session, role: str
) -> None:
    # CA-HU-011-03.
    oficina = _oficina(db, "firm")
    persona = _miembro(db, oficina, f"{role}@example.com", role)
    cliente = _sesion(dispositivo, persona)

    invitar = _invitar(cliente, "otro@example.com")
    listar = cliente.get(_INVITACIONES)
    miembros = cliente.get(_MIEMBROS)

    for respuesta in (invitar, listar, miembros):
        assert respuesta.status_code == 403
        assert respuesta.json()["detail"].startswith("No tiene permiso para esta acción.")
    assert _invitaciones(db, oficina) == []


def test_sin_sesion_no_se_invita(dispositivo: NuevoCliente) -> None:
    respuesta = _invitar(dispositivo(), "otro@example.com")

    assert respuesta.status_code == 401


def test_el_propietario_no_se_invita(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = _oficina(db)

    respuesta = _invitar(_sesion(dispositivo, oficina.owner), "otro@example.com", "owner")

    assert respuesta.status_code == 422


def test_un_correo_mal_escrito_no_se_invita(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = _oficina(db)

    respuesta = _invitar(_sesion(dispositivo, oficina.owner), "sin-arroba")

    assert respuesta.status_code == 422


def test_no_se_invita_a_quien_ya_es_miembro(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = _oficina(db, "firm")
    _miembro(db, oficina, "carlos@example.com", "lawyer")

    respuesta = _invitar(_sesion(dispositivo, oficina.owner), "CARLOS@example.com")

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"] == "Esta persona ya es miembro de su organización."


def test_no_se_duplica_una_invitacion_vigente(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = _oficina(db, "firm")
    cliente = _sesion(dispositivo, oficina.owner)
    assert _invitar(cliente, "carlos@example.com").status_code == 201

    repetida = _invitar(cliente, "Carlos@example.com")

    assert repetida.status_code == 409
    assert repetida.json()["detail"].startswith("Ya hay una invitación vigente para este correo.")


def test_una_invitacion_vencida_no_impide_invitar_de_nuevo(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = _oficina(db, "firm")
    cliente = _sesion(dispositivo, oficina.owner)
    primera = _invitar(cliente, "carlos@example.com").json()
    _vencer(db, oficina, uuid.UUID(primera["id"]))

    assert _invitar(cliente, "carlos@example.com").status_code == 201


def test_una_organizacion_en_solo_lectura_no_invita(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = _oficina(db)
    cliente = _sesion(dispositivo, oficina.owner)
    _contexto(db, oficina)
    db.execute(
        update(Organization)
        .where(Organization.id == oficina.organization_id)
        .values(status="read_only")
    )
    db.flush()

    respuesta = _invitar(cliente, "carlos@example.com")

    assert respuesta.status_code == 409
    assert "solo lectura" in respuesta.json()["detail"]


# --- Cupo del plan (CA-HU-011-02, RN-012) ---------------------------------------------------


def test_la_prueba_gratis_no_tiene_cupo_para_invitar(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = _oficina(db, "trial")

    respuesta = _invitar(_sesion(dispositivo, oficina.owner), "carlos@example.com")

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"] == (
        "Su plan incluye 1 usuario y ya están ocupados o invitados. Para invitar a alguien "
        "más, cambie de plan o revoque una invitación pendiente."
    )
    assert _invitaciones(db, oficina) == []


def test_las_invitaciones_abiertas_ocupan_cupo_hasta_revocarlas_o_vencer(
    dispositivo: NuevoCliente, db: Session
) -> None:
    # Profesional incluye 2 usuarios: el propietario y una persona más.
    oficina = _oficina(db, "professional")
    cliente = _sesion(dispositivo, oficina.owner)
    primera = _invitar(cliente, "carlos@example.com").json()

    sin_cupo = _invitar(cliente, "laura@example.com")
    assert sin_cupo.status_code == 409
    assert sin_cupo.json()["detail"].startswith("Su plan incluye 2 usuarios")

    assert cliente.delete(f"{_INVITACIONES}/{primera['id']}").status_code == 204
    segunda = _invitar(cliente, "laura@example.com")
    assert segunda.status_code == 201

    _vencer(db, oficina, uuid.UUID(segunda.json()["id"]))
    assert _invitar(cliente, "marta@example.com").status_code == 201


def test_el_plan_firma_admite_usuarios_adicionales(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = _oficina(db, "firm")
    _contexto(db, oficina)
    incluidos = db.scalar(select(Plan.included_users).where(Plan.code == "firm"))
    assert incluidos is not None
    for numero in range(incluidos - 1):
        _miembro(db, oficina, f"persona{numero}@example.com", "lawyer")
    cliente = _sesion(dispositivo, oficina.owner)

    respuesta = _invitar(cliente, "adicional@example.com")

    assert respuesta.status_code == 201
    cupo = cliente.get(_MIEMBROS).json()["seats"]
    assert cupo["used"] == incluidos + 1
    assert cupo["full"] is False
    assert cupo["extra_user_price_cop"] is not None


def test_el_tope_de_invitaciones_frena_los_envios_en_masa(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = _oficina(db, "firm")
    cliente = _sesion(dispositivo, oficina.owner)
    for numero in range(20):
        assert _invitar(cliente, f"persona{numero}@example.com").status_code == 201

    respuesta = _invitar(cliente, "una-mas@example.com")

    assert respuesta.status_code == 429
    assert "Retry-After" in respuesta.headers


# --- Listar y revocar (API-017 y API-018) -------------------------------------------------


def test_lista_las_pendientes_de_la_mas_reciente_y_marca_las_vencidas(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = _oficina(db, "firm")
    cliente = _sesion(dispositivo, oficina.owner)
    vieja = _invitar(cliente, "vieja@example.com").json()
    nueva = _invitar(cliente, "nueva@example.com").json()
    revocada = _invitar(cliente, "revocada@example.com").json()
    cliente.delete(f"{_INVITACIONES}/{revocada['id']}")
    _vencer(db, oficina, uuid.UUID(vieja["id"]))

    respuesta = cliente.get(_INVITACIONES)

    assert respuesta.status_code == 200
    assert respuesta.headers["cache-control"] == "no-store"
    cuerpo = respuesta.json()
    assert [item["id"] for item in cuerpo["items"]] == [nueva["id"], vieja["id"]]
    assert [item["expired"] for item in cuerpo["items"]] == [False, True]
    assert cuerpo["next_cursor"] is None


def test_las_invitaciones_se_paginan_por_cursor(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = _oficina(db, "firm")
    cliente = _sesion(dispositivo, oficina.owner)
    ids = [_invitar(cliente, f"persona{n}@example.com").json()["id"] for n in range(3)]

    primera = cliente.get(_INVITACIONES, params={"limit": 2}).json()
    segunda = cliente.get(
        _INVITACIONES, params={"limit": 2, "cursor": primera["next_cursor"]}
    ).json()

    assert [item["id"] for item in primera["items"]] == [ids[2], ids[1]]
    assert [item["id"] for item in segunda["items"]] == [ids[0]]
    assert segunda["next_cursor"] is None


def test_revocar_audita_y_no_se_puede_repetir(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = _oficina(db, "firm")
    cliente = _sesion(dispositivo, oficina.owner)
    invitacion = _invitar(cliente, "carlos@example.com").json()

    primera = cliente.delete(f"{_INVITACIONES}/{invitacion['id']}")
    segunda = cliente.delete(f"{_INVITACIONES}/{invitacion['id']}")

    assert primera.status_code == 204
    assert segunda.status_code == 404
    [revocada] = _invitaciones(db, oficina)
    assert revocada.revoked_at is not None
    [evento] = _auditoria(db, oficina, "invitation_revoked")
    assert evento.target_id == revocada.id


def test_otra_organizacion_no_ve_ni_revoca_las_invitaciones(
    dispositivo: NuevoCliente, db: Session
) -> None:
    propia = _oficina(db, "firm", nombre="Restrepo")
    ajena = _oficina(db, "firm", nombre="Gómez")
    invitacion = _invitar(_sesion(dispositivo, propia.owner), "carlos@example.com").json()
    intrusa = _sesion(dispositivo, ajena.owner)

    revocar = intrusa.delete(f"{_INVITACIONES}/{invitacion['id']}")
    listar = intrusa.get(_INVITACIONES)

    # El mismo 404 que una invitación que no existe: no revela nada de otra organización.
    assert revocar.status_code == 404
    assert revocar.json()["detail"] == "No encontramos lo que busca o no tiene acceso a ello."
    assert listar.json()["items"] == []
    [intacta] = _invitaciones(db, propia)
    assert intacta.revoked_at is None


# --- Miembros (API-015) -------------------------------------------------------------------


def test_lista_los_miembros_con_el_propietario_primero_y_el_cupo(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = _oficina(db, "firm")
    abogado = _miembro(db, oficina, "carlos@example.com", "lawyer")
    cliente = _sesion(dispositivo, oficina.owner)
    _invitar(cliente, "laura@example.com")

    cuerpo = cliente.get(_MIEMBROS).json()

    assert [(item["user_id"], item["role"]) for item in cuerpo["items"]] == [
        (str(oficina.owner.id), "owner"),
        (str(abogado.id), "lawyer"),
    ]
    assert cuerpo["items"][1]["full_name"] == "Carlos Gómez"
    assert cuerpo["next_cursor"] is None
    assert cuerpo["seats"]["used"] == 3


def test_la_lista_de_miembros_no_incluye_otras_organizaciones(
    dispositivo: NuevoCliente, db: Session
) -> None:
    propia = _oficina(db, "firm", nombre="Restrepo")
    _oficina(db, "firm", nombre="Gómez")

    cuerpo = _sesion(dispositivo, propia.owner).get(_MIEMBROS).json()

    assert [item["user_id"] for item in cuerpo["items"]] == [str(propia.owner.id)]


# --- Correo de invitación (trabajador) ------------------------------------------------------


def _correo(db: Session, settings: Settings, payload: dict[str, Any]) -> Any:
    return notifications.build_email(db, payload, settings)


def test_el_correo_lleva_un_enlace_cuyo_hash_queda_guardado(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    oficina = _oficina(db, "firm")
    _invitar(_sesion(dispositivo, oficina.owner), "carlos@example.com", "assistant")
    [payload] = _tareas(db)

    correo = _correo(db, settings, payload)

    assert correo.to == "carlos@example.com"
    assert correo.subject == "Invitación para unirse a Restrepo Abogados en ALETHEIA"
    assert "con el rol de asistente" in correo.text
    assert "Ana Restrepo le envió una invitación" in correo.text
    prefijo = f"{settings.public_url}/invitacion#t="
    [enlace] = [linea for linea in correo.text.splitlines() if linea.startswith(prefijo)]
    token = enlace.removeprefix(prefijo)
    [invitacion] = _invitaciones(db, oficina)
    assert invitacion.token_hash == opaque_token_hash(token)
    assert colombian_datetime(invitacion.expires_at) in correo.text
    # El nombre de quien invita va escapado en el HTML.
    assert "Ana Restrepo" in correo.html


def test_si_el_correo_se_reintenta_solo_sirve_el_ultimo_enlace(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    oficina = _oficina(db, "firm")
    _invitar(_sesion(dispositivo, oficina.owner), "carlos@example.com")
    [payload] = _tareas(db)

    primero = _correo(db, settings, payload)
    segundo = _correo(db, settings, payload)

    assert primero.text != segundo.text
    [invitacion] = _invitaciones(db, oficina)
    token = segundo.text.split("#t=")[1].split()[0]
    assert invitacion.token_hash == opaque_token_hash(token)


def test_no_sale_correo_de_una_invitacion_revocada_o_vencida(
    dispositivo: NuevoCliente, db: Session, settings: Settings
) -> None:
    oficina = _oficina(db, "firm")
    cliente = _sesion(dispositivo, oficina.owner)
    revocada = _invitar(cliente, "revocada@example.com").json()
    vencida = _invitar(cliente, "vencida@example.com").json()
    cliente.delete(f"{_INVITACIONES}/{revocada['id']}")
    _vencer(db, oficina, uuid.UUID(vencida["id"]))

    for payload in _tareas(db):
        assert _correo(db, settings, payload) is None


def test_la_fecha_del_correo_esta_en_hora_de_colombia() -> None:
    momento = datetime.datetime(2026, 11, 10, 20, 5, tzinfo=datetime.UTC)

    assert colombian_datetime(momento) == "10 de noviembre de 2026 a las 3:05 p. m."
    assert (
        colombian_datetime(momento.replace(hour=5)) == "10 de noviembre de 2026 a las 12:05 a. m."
    )
