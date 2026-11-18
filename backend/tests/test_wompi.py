"""Adaptador de Wompi (ADR-010, HU-027): firma de integridad y verificación de webhooks."""

from typing import Any

import pytest

from app.adapters import wompi
from app.core.config import Settings


def test_la_firma_de_integridad_coincide_con_el_vector_de_la_documentacion() -> None:
    """Ejemplo literal de la guía de Checkout Web (docs.wompi.co)."""
    firma = wompi.firma_de_integridad(
        "sk8-438k4-xmxm392-sn2m2",
        490000,
        "COP",
        "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6",
    )
    assert firma == "37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5"


def _evento(properties: list[str], checksum: str, timestamp: int = 1530291411) -> dict[str, Any]:
    return {
        "event": "transaction.updated",
        "data": {
            "transaction": {
                "id": "1234-1610641025-49201",
                "status": "APPROVED",
                "amount_in_cents": 4490000,
            }
        },
        "signature": {"properties": properties, "checksum": checksum},
        "timestamp": timestamp,
    }


def test_un_webhook_con_checksum_correcto_es_valido() -> None:
    secreto = "prod_events_test"
    propiedades = ["transaction.id", "transaction.status", "transaction.amount_in_cents"]
    cadena = "1234-1610641025-49201APPROVED44900001530291411" + secreto
    import hashlib

    checksum = hashlib.sha256(cadena.encode()).hexdigest()
    assert wompi.firma_de_webhook_es_valida(_evento(propiedades, checksum), secreto)


def test_un_webhook_con_checksum_incorrecto_no_es_valido() -> None:
    assert not wompi.firma_de_webhook_es_valida(
        _evento(["transaction.id"], "0" * 64), "prod_events_test"
    )


def test_un_webhook_sin_firma_no_es_valido() -> None:
    assert not wompi.firma_de_webhook_es_valida({"data": {}, "timestamp": 1}, "secreto")


def test_un_webhook_con_una_propiedad_que_no_existe_no_es_valido() -> None:
    assert not wompi.firma_de_webhook_es_valida(
        _evento(["transaction.no_existe"], "0" * 64), "prod_events_test"
    )


def test_credenciales_de_exige_las_cuatro_variables(settings: Settings) -> None:
    incompletas = settings.model_copy(update={"wompi_public_key": "pub_test_x"})
    with pytest.raises(wompi.WompiNoConfiguradoError):
        wompi.credenciales_de(incompletas)
