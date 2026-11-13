"""Pruebas de abrir y aceptar una invitación (HU-012, CA-HU-012-01 a CA-HU-012-03, CP-012)."""

import datetime
import uuid
from typing import Any

import pytest
from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

from app.api.cookies import ACCESS_COOKIE
from app.core.legal import LEGAL_VERSION
from app.core.tokens import new_opaque_token, opaque_token_hash
from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Invitation, LegalAcceptance, Membership, Organization, User
from app.services.members import INVITATION_LIFETIME
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina, crear_persona

_VER = "/api/v1/invitations/preview"
_ACEPTAR = "/api/v1/invitations/accept"
_PERFIL = "/api/v1/me"
_NUEVA = "mi frase nueva para ALETHEIA"
_CORTA = "corta"
_INVALIDA = (
    "Esta invitación ya no sirve: venció, ya se usó o la revocaron. Pida una nueva a quien le "
    "envió la invitación."
)


def _invitacion(
    db: Session,
    oficina: Oficina,
    email: str = "carlos@example.com",
    role: str = "lawyer",
    *,
    vence: datetime.timedelta = INVITATION_LIFETIME,
) -> str:
    """Una invitación abierta con un token conocido, como la deja el correo al enviarse."""
    token = new_opaque_token()
    set_tenant(db, TenantContext(organization_id=oficina.organization_id))
    db.add(
        Invitation(
            organization_id=oficina.organization_id,
            email=email,
            role=role,
            token_hash=opaque_token_hash(token),
            invited_by=oficina.owner.id,
            expires_at=datetime.datetime.now(datetime.UTC) + vence,
        )
    )
    db.flush()
    set_tenant(db, TenantContext())
    return token


def _nueva_cuenta(token: str, **cambios: Any) -> dict[str, Any]:
    return {
        "token": token,
        "full_name": "Carlos Gómez",
        "password": _NUEVA,
        "legal_version": LEGAL_VERSION,
        "accepts_legal_terms": True,
    } | cambios


def _membresia(db: Session, user_id: uuid.UUID) -> Membership | None:
    set_tenant(db, TenantContext(user_id=user_id))
    statement = (
        select(Membership)
        .where(Membership.user_id == user_id)
        .execution_options(populate_existing=True)
    )
    return db.scalar(statement)


def _usuario(db: Session, email: str) -> User | None:
    return db.scalar(
        select(User).where(User.email == email).execution_options(populate_existing=True)
    )


def _abierta(db: Session, oficina: Oficina) -> Invitation:
    set_tenant(db, TenantContext(organization_id=oficina.organization_id))
    invitation = db.scalar(select(Invitation).execution_options(populate_existing=True))
    assert invitation is not None
    return invitation


# --- Ver la invitación (API-052) ----------------------------------------------------------


def test_muestra_la_organizacion_el_rol_y_quien_invita(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    token = _invitacion(db, oficina, role="assistant")

    respuesta = dispositivo().post(_VER, json={"token": token})

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.headers["cache-control"] == "no-store"
    cuerpo = respuesta.json()
    assert cuerpo["organization_name"] == "Restrepo Abogados"
    assert cuerpo["inviter_name"] == "Ana Restrepo"
    assert cuerpo["email"] == "carlos@example.com"
    assert cuerpo["role"] == "assistant"
    assert cuerpo["account"] == "new"


def test_dice_si_el_correo_ya_tiene_cuenta_o_pertenece_a_otra_organizacion(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    crear_persona(db, "sin-oficina@example.com")
    otra = crear_oficina(db, "firm", nombre="Gómez")
    crear_miembro(db, otra, "ocupado@example.com", "lawyer")
    cliente = dispositivo()

    sin_oficina = cliente.post(
        _VER, json={"token": _invitacion(db, oficina, "sin-oficina@example.com")}
    )
    ocupado = cliente.post(_VER, json={"token": _invitacion(db, oficina, "ocupado@example.com")})

    assert sin_oficina.json()["account"] == "existing"
    assert ocupado.json()["account"] == "member_elsewhere"


@pytest.mark.parametrize("estado", ["vencida", "revocada", "aceptada", "inexistente"])
def test_un_enlace_que_no_sirve_da_siempre_el_mismo_error(
    dispositivo: NuevoCliente, db: Session, estado: str
) -> None:
    # CA-HU-012-02: vencida, revocada, ya usada o inventada, la respuesta es la misma.
    oficina = crear_oficina(db, "firm")
    token = _invitacion(db, oficina)
    ahora = datetime.datetime.now(datetime.UTC)
    cambios = {
        "vencida": {"expires_at": ahora - datetime.timedelta(minutes=1)},
        "revocada": {"revoked_at": ahora},
        "aceptada": {"accepted_at": ahora},
    }
    if estado == "inexistente":
        token = new_opaque_token()
    else:
        set_tenant(db, TenantContext(organization_id=oficina.organization_id))
        db.execute(update(Invitation).values(**cambios[estado]))
        db.flush()
    cliente = dispositivo()

    ver = cliente.post(_VER, json={"token": token})
    aceptar = cliente.post(_ACEPTAR, json=_nueva_cuenta(token))

    for respuesta in (ver, aceptar):
        assert respuesta.status_code == 400
        assert respuesta.json()["detail"] == _INVALIDA


def test_un_token_demasiado_largo_se_rechaza_sin_consultar(dispositivo: NuevoCliente) -> None:
    respuesta = dispositivo().post(_VER, json={"token": "x" * 65})

    assert respuesta.status_code == 422


# --- Aceptar con una cuenta nueva (API-019, CA-HU-012-01) ----------------------------------


def test_acepta_crea_la_cuenta_con_el_rol_y_abre_la_sesion(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    token = _invitacion(db, oficina, role="assistant")
    cliente = dispositivo()

    respuesta = cliente.post(_ACEPTAR, json=_nueva_cuenta(token))

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json() == {"organization_name": "Restrepo Abogados", "role": "assistant"}
    assert ACCESS_COOKIE in respuesta.cookies
    perfil = cliente.get(_PERFIL).json()
    assert perfil["email"] == "carlos@example.com"
    assert perfil["email_verified"] is True
    assert perfil["organization"]["role"] == "assistant"

    user = _usuario(db, "carlos@example.com")
    assert user is not None
    membresia = _membresia(db, user.id)
    assert membresia is not None
    assert membresia.organization_id == oficina.organization_id
    assert _abierta(db, oficina).accepted_at is not None
    pruebas = db.scalars(select(LegalAcceptance).where(LegalAcceptance.user_id == user.id))
    assert [prueba.context for prueba in pruebas] == ["registration"]
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=user.id))
    acciones = {evento.action for evento in db.scalars(select(AuditLog))}
    assert {"user_registered", "invitation_accepted", "login"} <= acciones


def test_el_mismo_enlace_no_sirve_dos_veces(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    token = _invitacion(db, oficina)
    assert dispositivo().post(_ACEPTAR, json=_nueva_cuenta(token)).status_code == 201

    segunda = dispositivo().post(_ACEPTAR, json=_nueva_cuenta(token))

    assert segunda.status_code == 400
    assert segunda.json()["detail"] == _INVALIDA


def test_una_cuenta_nueva_exige_contrasena_larga_y_aceptar_los_textos(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    token = _invitacion(db, oficina)
    cliente = dispositivo()

    corta = cliente.post(_ACEPTAR, json=_nueva_cuenta(token, password=_CORTA))
    sin_textos = cliente.post(_ACEPTAR, json=_nueva_cuenta(token, accepts_legal_terms=None))
    textos_viejos = cliente.post(_ACEPTAR, json=_nueva_cuenta(token, legal_version="2020-01-01"))

    assert corta.status_code == 422
    assert sin_textos.status_code == 422
    assert textos_viejos.status_code == 409
    assert _usuario(db, "carlos@example.com") is None
    assert _abierta(db, oficina).accepted_at is None


def test_sin_nombre_y_sin_cuenta_pide_los_datos(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    token = _invitacion(db, oficina)

    respuesta = dispositivo().post(_ACEPTAR, json={"token": token, "password": _NUEVA})

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"].startswith("Para crear su cuenta escriba su nombre")


# --- Aceptar con una cuenta existente -------------------------------------------------------


def test_una_cuenta_sin_organizacion_acepta_con_su_contrasena(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    existente = crear_persona(db, "laura@example.com", "Laura Vélez")
    token = _invitacion(db, oficina, "laura@example.com", "admin")

    respuesta = dispositivo().post(_ACEPTAR, json={"token": token, "password": CLAVE})

    assert respuesta.status_code == 201, respuesta.text
    membresia = _membresia(db, existente.id)
    assert membresia is not None
    assert membresia.role == "admin"


def test_una_cuenta_existente_con_otra_contrasena_no_acepta(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    existente = crear_persona(db, "laura@example.com")
    token = _invitacion(db, oficina, "laura@example.com")

    respuesta = dispositivo().post(_ACEPTAR, json={"token": token, "password": "otra frase"})

    assert respuesta.status_code == 401
    assert respuesta.json()["detail"].startswith("La contraseña no coincide")
    assert _membresia(db, existente.id) is None
    assert _abierta(db, oficina).accepted_at is None


def test_quien_ya_pertenece_a_otra_organizacion_no_puede_aceptar(
    dispositivo: NuevoCliente, db: Session
) -> None:
    # CA-HU-012-03, RN-011.
    oficina = crear_oficina(db, "firm")
    otra = crear_oficina(db, "firm", nombre="Gómez")
    ocupado = crear_miembro(db, otra, "ocupado@example.com", "lawyer")
    token = _invitacion(db, oficina, "ocupado@example.com")

    respuesta = dispositivo().post(_ACEPTAR, json={"token": token, "password": CLAVE})

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"].startswith("Su correo ya pertenece a una organización")
    membresia = _membresia(db, ocupado.id)
    assert membresia is not None
    assert membresia.organization_id == otra.organization_id
    assert _abierta(db, oficina).accepted_at is None


def test_una_organizacion_en_solo_lectura_no_suma_personas(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    token = _invitacion(db, oficina)
    set_tenant(db, TenantContext(organization_id=oficina.organization_id))
    db.execute(update(Organization).values(status="read_only"))
    db.flush()

    respuesta = dispositivo().post(_ACEPTAR, json=_nueva_cuenta(token))

    assert respuesta.status_code == 409
    assert _usuario(db, "carlos@example.com") is None


def test_probar_enlaces_tiene_un_tope_por_ip(dispositivo: NuevoCliente) -> None:
    cliente = dispositivo()
    for _ in range(20):
        assert cliente.post(_VER, json={"token": new_opaque_token()}).status_code == 400

    respuesta = cliente.post(_VER, json={"token": new_opaque_token()})

    assert respuesta.status_code == 429


def test_la_funcion_de_busqueda_solo_entrega_identificadores(db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    token = _invitacion(db, oficina)
    # Sin contexto, Row-Level Security no deja ver la invitación…
    set_tenant(db, TenantContext())
    assert db.scalars(select(Invitation)).all() == []
    # …pero la función la encuentra por el hash del token, y solo da sus identificadores.
    fila = db.execute(
        text("SELECT * FROM invitation_for_token(:hash)"), {"hash": opaque_token_hash(token)}
    ).one()
    assert set(fila._mapping) == {"invitation_id", "organization_id"}
    assert fila.organization_id == oficina.organization_id
