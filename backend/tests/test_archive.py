"""Pruebas del banco de datos: búsqueda en el archivo, cifras e índice exportable."""

import datetime
import hashlib
import uuid
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.db.tenancy import TenantContext, set_tenant
from app.models import Evidence
from app.services import archive
from app.services.cases import list_cases
from tests.conftest import NuevoCliente
from tests.organizations import Oficina, crear_miembro, crear_oficina
from tests.test_cases_list import _AHORA, _caso, _principal, _sesion

_BOGOTA = ZoneInfo("America/Bogota")


def _con_archivo(
    db: Session, oficina: Oficina, caso_id: uuid.UUID, nombre: str, contenido: bytes
) -> str:
    """Agrega una evidencia con un nombre conocido y devuelve su huella en hexadecimal."""
    set_tenant(db, TenantContext(organization_id=oficina.organization_id, user_id=oficina.owner.id))
    evidencia_id = uuid.uuid7()
    huella = hashlib.sha256(contenido)
    db.add(
        Evidence(
            id=evidencia_id,
            organization_id=oficina.organization_id,
            case_id=caso_id,
            sha256=huella.digest(),
            size_bytes=len(contenido),
            original_filename=nombre,
            declared_type="document",
            detected_type="application/pdf",
            declared_origin="Entregada por el cliente",
            storage_key=f"cases/{caso_id}/{evidencia_id}",
            tsa_status="pending",
            uploaded_by=oficina.owner.id,
        )
    )
    db.flush()
    set_tenant(db, TenantContext())
    return huella.hexdigest()


def _cerrados(db: Session, oficina: Oficina) -> dict[str, uuid.UUID]:
    dueno = oficina.owner
    return {
        "laboral": _caso(
            db,
            oficina,
            [dueno],
            titulo="Despido de María Pérez",
            estado="closed",
            cerrado_en=datetime.datetime(2025, 3, 10, 15, 0, tzinfo=datetime.UTC),
            retencion_hasta=_AHORA - datetime.timedelta(days=2),
            especialidad="labor",
        ),
        "familia": _caso(
            db,
            oficina,
            [dueno],
            titulo="Sucesión Gómez",
            estado="closed",
            cerrado_en=datetime.datetime(2026, 6, 1, 15, 0, tzinfo=datetime.UTC),
            bloqueo=True,
            fundamento="litigation_hold",
            especialidad="family",
        ),
        "abierto": _caso(db, oficina, [dueno], titulo="Caso todavía abierto"),
    }


def test_la_busqueda_encuentra_un_caso_por_el_nombre_de_su_archivo_y_por_su_huella(
    db: Session,
) -> None:
    oficina = crear_oficina(db, "firm")
    casos = _cerrados(db, oficina)
    huella = _con_archivo(db, oficina, casos["laboral"], "Contrato Término Fijo.pdf", b"contrato")
    principal = _principal(oficina, oficina.owner)

    def ids(**filtros: object) -> set[uuid.UUID]:
        listado = list_cases(db, principal, status="closed", cursor=None, limit=50, **filtros)  # type: ignore[arg-type]
        return {item.id for item in listado.items}

    assert ids(search="termino fijo") == {casos["laboral"]}
    assert ids(search=huella[:12]) == {casos["laboral"]}
    assert ids(search=huella.upper()[:12]) == {casos["laboral"]}
    # Una huella que no existe, o demasiado corta para serlo, no encuentra nada por huella.
    assert ids(search="0" * 12) == set()
    assert ids(search="sucesion") == {casos["familia"]}


def test_el_filtro_por_especialidad_solo_aplica_al_archivo(db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    casos = _cerrados(db, oficina)
    principal = _principal(oficina, oficina.owner)

    listado = list_cases(
        db, principal, status="closed", cursor=None, limit=50, practice_area="family"
    )

    assert [item.id for item in listado.items] == [casos["familia"]]


def test_las_cifras_cuentan_solo_los_casos_cerrados_de_la_persona(db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    casos = _cerrados(db, oficina)
    _con_archivo(db, oficina, casos["laboral"], "a.pdf", b"uno")
    _con_archivo(db, oficina, casos["laboral"], "b.pdf", b"dos-dos")
    _con_archivo(db, oficina, casos["abierto"], "c.pdf", b"no-cuenta")
    ajeno = crear_miembro(db, oficina, "ajeno@example.com", "lawyer")

    propio = archive.summary(db, _principal(oficina, oficina.owner), archive.ArchiveFilters())
    del_ajeno = archive.summary(db, _principal(oficina, ajeno, "lawyer"), archive.ArchiveFilters())

    assert propio.cases == 2
    assert propio.evidences == 2
    assert propio.stored_bytes == len(b"uno") + len(b"dos-dos")
    assert propio.legal_hold == 1
    assert propio.review_due == 1
    assert propio.review_upcoming == 1
    assert propio.by_year == [(2026, 1), (2025, 1)]
    # Quien no es miembro de ningún caso cerrado no ve nada del archivo.
    assert del_ajeno.cases == 0
    assert del_ajeno.by_year == []


def test_el_indice_exportado_trae_las_tildes_y_neutraliza_formulas(db: Session) -> None:
    oficina = crear_oficina(db, "firm")
    _caso(
        db,
        oficina,
        [oficina.owner],
        titulo='=HYPERLINK("http://x")',
        estado="closed",
        despacho="Juzgado 2º Laboral de Medellín",
        cerrado_en=datetime.datetime(2026, 6, 1, 15, 0, tzinfo=datetime.UTC),
    )

    texto = archive.export_index(
        db, _principal(oficina, oficina.owner), archive.ArchiveFilters(), _BOGOTA
    )

    assert texto.startswith("﻿Título,Radicado,")
    assert "'=HYPERLINK" in texto
    assert "Medellín" in texto
    assert "2026-06-01" in texto


def test_el_resumen_y_el_indice_exigen_sesion_y_responden_a_un_miembro(
    dispositivo: NuevoCliente, db: Session
) -> None:
    oficina = crear_oficina(db, "firm")
    _cerrados(db, oficina)

    assert dispositivo().get("/api/v1/archive/summary").status_code == 401
    assert dispositivo().get("/api/v1/archive/export").status_code == 401

    cliente = _sesion(dispositivo, oficina.owner)
    resumen = cliente.get("/api/v1/archive/summary")
    assert resumen.status_code == 200, resumen.text
    assert resumen.json()["cases"] == 2
    assert resumen.headers["cache-control"] == "no-store"
    indice = cliente.get("/api/v1/archive/export", params={"search": "sucesion"})
    assert indice.status_code == 200
    assert indice.headers["content-type"].startswith("text/csv")
    assert "attachment" in indice.headers["content-disposition"]
    assert "Sucesión Gómez" in indice.text
    assert "Despido" not in indice.text
    invertido = cliente.get(
        "/api/v1/archive/summary", params={"closed_from": "2026-02-01", "closed_to": "2026-01-01"}
    )
    assert invertido.status_code == 422
