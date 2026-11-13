"""Pruebas de cambiar el rol y retirar miembros (HU-013, CA-HU-013-01 a CA-HU-013-03, CP-013)."""

import os
import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import AuditLog, Case, CaseMember, Membership, RefreshToken, User
from tests.conftest import NuevoCliente
from tests.organizations import CLAVE, Oficina, crear_miembro, crear_oficina, crear_persona

_INGRESO = "/api/v1/auth/login"
_RENOVAR = "/api/v1/auth/refresh"
_PERFIL = "/api/v1/me"
_MIEMBROS = "/api/v1/organization/members"


def _sesion(dispositivo: NuevoCliente, user: User) -> TestClient:
    cliente = dispositivo()
    respuesta = cliente.post(_INGRESO, json={"email": user.email, "password": CLAVE})
    assert respuesta.status_code == 204, respuesta.text
    return cliente


def _cambiar(cliente: TestClient, user: User, role: str) -> Any:
    return cliente.patch(f"{_MIEMBROS}/{user.id}", json={"role": role})


def _retirar(cliente: TestClient, user: User) -> Any:
    return cliente.delete(f"{_MIEMBROS}/{user.id}")


def _contexto(db: Session, oficina: Oficina) -> None:
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=oficina.owner.id))


def _auditoria(db: Session, oficina: Oficina, action: str) -> list[AuditLog]:
    _contexto(db, oficina)
    return list(db.scalars(select(AuditLog).where(AuditLog.action == action)))


def _rol(db: Session, oficina: Oficina, user: User) -> str | None:
    _contexto(db, oficina)
    statement = select(Membership.role).where(Membership.user_id == user.id)
    return db.scalar(statement)


def _asignar_a_un_caso(db: Session, oficina: Oficina, user: User) -> uuid.UUID:
    _contexto(db, oficina)
    caso = Case(
        organization_id=oficina.organization_id,
        title="Caso de prueba",
        wrapped_key=os.urandom(40),
        key_version="prueba",
        created_by=oficina.owner.id,
    )
    db.add(caso)
    db.flush()
    db.add(
        CaseMember(
            case_id=caso.id,
            user_id=user.id,
            organization_id=oficina.organization_id,
            added_by=oficina.owner.id,
        )
    )
    db.flush()
    return caso.id


def _asignaciones(db: Session, oficina: Oficina, user: User) -> int:
    _contexto(db, oficina)
    return len(list(db.scalars(select(CaseMember).where(CaseMember.user_id == user.id))))


# --- Cambiar el rol (API-020, CA-HU-013-01) ---------------------------------------------------


def test_el_propietario_cambia_el_rol_y_queda_en_la_auditoria(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    persona = crear_miembro(db, oficina, "ana@example.com", "assistant")
    cliente = _sesion(dispositivo, oficina.owner)

    respuesta = _cambiar(cliente, persona, "lawyer")

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["role"] == "lawyer"
    assert respuesta.json()["user_id"] == str(persona.id)
    assert respuesta.headers["cache-control"] == "no-store"
    assert _rol(db, oficina, persona) == "lawyer"
    (evento,) = _auditoria(db, oficina, "role_changed")
    assert evento.target_id == persona.id
    assert evento.actor_user_id == oficina.owner.id


def test_el_administrador_tambien_cambia_roles(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    admin = crear_miembro(db, oficina, "admin@example.com", "admin")
    persona = crear_miembro(db, oficina, "ana@example.com", "lawyer")

    respuesta = _cambiar(_sesion(dispositivo, admin), persona, "admin")

    assert respuesta.status_code == 200, respuesta.text
    assert _rol(db, oficina, persona) == "admin"


def test_el_nuevo_rol_rige_en_la_siguiente_peticion_de_esa_persona(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    persona = crear_miembro(db, oficina, "ana@example.com", "admin")
    de_ana = _sesion(dispositivo, persona)
    assert de_ana.get(_MIEMBROS).status_code == 200

    _cambiar(_sesion(dispositivo, oficina.owner), persona, "assistant")

    # Con la misma sesión y el mismo token: ya no administra.
    assert de_ana.get(_MIEMBROS).status_code == 403
    assert de_ana.get(_PERFIL).json()["organization"]["role"] == "assistant"


def test_repetir_el_mismo_rol_no_deja_otro_evento(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    persona = crear_miembro(db, oficina, "ana@example.com", "lawyer")
    cliente = _sesion(dispositivo, oficina.owner)

    assert _cambiar(cliente, persona, "lawyer").status_code == 200

    assert _auditoria(db, oficina, "role_changed") == []


def test_el_propietario_no_cambia_de_rol_ni_se_asigna(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    admin = crear_miembro(db, oficina, "admin@example.com", "admin")
    cliente = _sesion(dispositivo, admin)

    respuesta = _cambiar(cliente, oficina.owner, "assistant")

    assert respuesta.status_code == 403
    assert "propietario" in respuesta.json()["detail"]
    assert _rol(db, oficina, oficina.owner) == "owner"
    # El rol propietario no se ofrece: el esquema lo rechaza.
    persona = crear_miembro(db, oficina, "ana@example.com", "lawyer")
    assert _cambiar(cliente, persona, "owner").status_code == 422
    assert _rol(db, oficina, persona) == "lawyer"


def test_nadie_cambia_su_propio_rol(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    admin = crear_miembro(db, oficina, "admin@example.com", "admin")

    respuesta = _cambiar(_sesion(dispositivo, admin), admin, "lawyer")

    assert respuesta.status_code == 403
    assert "propio rol" in respuesta.json()["detail"]
    assert _rol(db, oficina, admin) == "admin"


def test_un_abogado_o_un_asistente_no_gestiona_miembros(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    objetivo = crear_miembro(db, oficina, "objetivo@example.com", "assistant")
    for rol in ("lawyer", "assistant"):
        persona = crear_miembro(db, oficina, f"{rol}@example.com", rol)
        cliente = _sesion(dispositivo, persona)

        assert _cambiar(cliente, objetivo, "admin").status_code == 403
        assert _retirar(cliente, objetivo).status_code == 403

    assert _rol(db, oficina, objetivo) == "assistant"


def test_sin_sesion_no_se_gestionan_miembros(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    cliente = dispositivo()

    assert (
        cliente.patch(f"{_MIEMBROS}/{oficina.owner.id}", json={"role": "lawyer"}).status_code == 401
    )
    assert cliente.delete(f"{_MIEMBROS}/{oficina.owner.id}").status_code == 401


def test_el_cuerpo_no_admite_campos_de_mas(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    persona = crear_miembro(db, oficina, "ana@example.com", "lawyer")
    cliente = _sesion(dispositivo, oficina.owner)

    respuesta = cliente.patch(
        f"{_MIEMBROS}/{persona.id}", json={"role": "admin", "organization_id": str(uuid.uuid4())}
    )

    assert respuesta.status_code == 422


def test_una_persona_de_otra_organizacion_no_existe_para_quien_administra(
    dispositivo: NuevoCliente, db: Session
) -> None:
    propia = crear_oficina(db, "firm", nombre="Propia")
    ajena = crear_oficina(db, "firm", nombre="Ajena")
    ajeno = crear_miembro(db, ajena, "ajeno@example.com", "lawyer")
    cliente = _sesion(dispositivo, propia.owner)

    desconocido = _cambiar(cliente, crear_persona(db, "libre@example.com"), "admin")

    assert _cambiar(cliente, ajeno, "admin").status_code == 404
    assert _retirar(cliente, ajeno).status_code == 404
    # Igual que quien no existe: no revela de quién es la cuenta.
    assert desconocido.status_code == 404
    assert _cambiar(cliente, ajeno, "admin").json()["detail"] == desconocido.json()["detail"]
    assert _rol(db, ajena, ajeno) == "lawyer"


# --- Retirar (API-021, CA-HU-013-01 y CA-HU-013-02) -------------------------------------------


def test_retirar_a_un_miembro_cierra_sus_sesiones_y_lo_saca_de_sus_casos(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    persona = crear_miembro(db, oficina, "ana@example.com", "lawyer")
    _asignar_a_un_caso(db, oficina, persona)
    de_ana = _sesion(dispositivo, persona)
    assert de_ana.get(_PERFIL).json()["organization"] is not None

    respuesta = _retirar(_sesion(dispositivo, oficina.owner), persona)

    assert respuesta.status_code == 204, respuesta.text
    assert _rol(db, oficina, persona) is None
    assert _asignaciones(db, oficina, persona) == 0
    (evento,) = _auditoria(db, oficina, "member_removed")
    assert evento.target_id == persona.id
    # La sesión se cierra al instante: ni el token de acceso aún vivo ni la renovación sirven.
    assert de_ana.get(_PERFIL).status_code == 401
    assert de_ana.get(_MIEMBROS).status_code == 401
    assert de_ana.post(_RENOVAR).status_code == 401
    # Su cuenta sigue existiendo: puede volver a ingresar, ahora sin organización.
    de_nuevo = _sesion(dispositivo, persona)
    assert de_nuevo.get(_PERFIL).json()["organization"] is None
    assert de_nuevo.get(_MIEMBROS).status_code == 403
    de_nuevo.close()
    assert (
        db.scalar(
            select(func.count())
            .select_from(RefreshToken)
            .where(RefreshToken.user_id == persona.id, RefreshToken.revoked_at.is_(None))
        )
        == 1
    )  # Solo la sesión nueva.


def test_retirar_libera_el_cupo_del_plan(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "professional")
    persona = crear_miembro(db, oficina, "ana@example.com", "lawyer")
    cliente = _sesion(dispositivo, oficina.owner)
    antes = cliente.get(_MIEMBROS).json()["seats"]["used"]

    _retirar(cliente, persona)

    assert cliente.get(_MIEMBROS).json()["seats"]["used"] == antes - 1


def test_el_propietario_no_se_retira(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    admin = crear_miembro(db, oficina, "admin@example.com", "admin")

    respuesta = _retirar(_sesion(dispositivo, admin), oficina.owner)

    assert respuesta.status_code == 403
    assert "propietario" in respuesta.json()["detail"]
    assert _rol(db, oficina, oficina.owner) == "owner"
    assert _auditoria(db, oficina, "member_removed") == []


def test_nadie_se_retira_a_si_mismo(dispositivo: NuevoCliente, db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    admin = crear_miembro(db, oficina, "admin@example.com", "admin")

    respuesta = _retirar(_sesion(dispositivo, admin), admin)

    assert respuesta.status_code == 403
    assert _rol(db, oficina, admin) == "admin"


def test_quien_fue_retirado_puede_ser_invitado_de_nuevo_sin_recuperar_sus_casos(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    persona = crear_miembro(db, oficina, "ana@example.com", "lawyer")
    _asignar_a_un_caso(db, oficina, persona)
    cliente = _sesion(dispositivo, oficina.owner)

    _retirar(cliente, persona)
    reinvitada = cliente.post(
        "/api/v1/organization/invitations", json={"email": persona.email, "role": "lawyer"}
    )

    assert reinvitada.status_code == 201, reinvitada.text
    assert _asignaciones(db, oficina, persona) == 0
