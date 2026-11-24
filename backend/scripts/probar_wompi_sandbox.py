r"""Prueba, contra el entorno de pruebas (sandbox) de Wompi, lo que su documentación no aclara de la
renovación automática con Nequi (ADR-058).

Lee las llaves de pruebas de `backend/.env.wompi-sandbox` (Git la ignora) y no imprime ninguna.
Solo habla con https://sandbox.wompi.co: nunca con producción, y se niega a correr con llaves que
no sean de pruebas. Muestra las respuestas completas de Wompi (que en sandbox no llevan datos
reales) para ver exactamente qué pide cada paso.

Uso, desde backend/:  .venv\Scripts\python.exe scripts\probar_wompi_sandbox.py
"""

import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

BASE = "https://sandbox.wompi.co/v1"
ARCHIVO = Path(__file__).resolve().parents[1] / ".env.wompi-sandbox"
CELULAR_APRUEBA = "3991111111"
CELULAR_DECLINA = "3992222222"
MONTO_CENTAVOS = 150_000  # 1.500 pesos: dinero de mentira en sandbox


def firma_de_integridad(referencia: str, centavos: int, moneda: str, secreto: str) -> str:
    """La misma firma que usa el adaptador: SHA-256 de referencia, monto, moneda y secreto."""
    return hashlib.sha256(f"{referencia}{centavos}{moneda}{secreto}".encode()).hexdigest()


def llaves() -> dict[str, str]:
    if not ARCHIVO.exists():
        sys.exit(f"Falta {ARCHIVO.name} con las llaves de pruebas (ver docs/operacion).")
    valores: dict[str, str] = {}
    for linea in ARCHIVO.read_text(encoding="utf-8").splitlines():
        if "=" in linea and not linea.lstrip().startswith("#"):
            nombre, _, valor = linea.partition("=")
            valores[nombre.strip()] = valor.strip()
    esperadas = {
        "WOMPI_PUBLIC_KEY": "pub_test_",
        "WOMPI_PRIVATE_KEY": "prv_test_",
        "WOMPI_INTEGRITY_SECRET": "test_integrity_",
    }
    for nombre, prefijo in esperadas.items():
        if not valores.get(nombre, "").startswith(prefijo):
            sys.exit(f"{nombre} falta o no es una llave de pruebas ({prefijo}…). No sigo.")
    return valores


def llamar(
    metodo: str,
    ruta: str,
    *,
    bearer: str | None = None,
    cuerpo: dict | None = None,
    encabezados: dict[str, str] | None = None,
) -> tuple[int, dict]:
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    todos = {"Content-Type": "application/json", "Accept": "application/json"}
    if bearer:
        todos["Authorization"] = f"Bearer {bearer}"
    todos.update(encabezados or {})
    peticion = urllib.request.Request(  # noqa: S310
        BASE + ruta, data=datos, headers=todos, method=metodo
    )
    try:
        with urllib.request.urlopen(peticion, timeout=20) as respuesta:  # noqa: S310
            return respuesta.status, json.loads(respuesta.read() or b"{}")
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read() or b"{}")
        except json.JSONDecodeError:
            return error.code, {}


def mostrar(titulo: str, codigo: int, cuerpo: dict) -> None:
    print(
        f"\n--- {titulo}\nHTTP {codigo}\n{json.dumps(cuerpo, indent=2, ensure_ascii=False)[:1500]}"
    )


def aceptacion_nueva(k: dict[str, str]) -> dict[str, str]:
    _, info = llamar(
        "GET", "/merchants/info", encabezados={"x-merchant-public-key": k["WOMPI_PUBLIC_KEY"]}
    )
    data = info["data"]
    return {
        "acceptance_token": data["presigned_acceptance"]["acceptance_token"],
        "accept_personal_auth": data["presigned_personal_data_auth"]["acceptance_token"],
    }


def crear_fuente(k: dict[str, str], celular: str, aceptacion: dict) -> int | None:
    aceptacion = aceptacion_nueva(k)
    codigo, token = llamar(
        "POST", "/tokens/nequi", bearer=k["WOMPI_PUBLIC_KEY"], cuerpo={"phone_number": celular}
    )
    mostrar(f"Token Nequi con {celular}", codigo, token)
    token_id = token.get("data", {}).get("id")
    if not token_id:
        return None
    estado = token["data"].get("status")
    for _ in range(10):
        if estado not in ("PENDING", None):
            break
        time.sleep(2)
        codigo, consulta = llamar("GET", f"/tokens/nequi/{token_id}", bearer=k["WOMPI_PUBLIC_KEY"])
        estado = consulta.get("data", {}).get("status")
        mostrar("Consulta del token Nequi", codigo, consulta)
    print(f"\nEstado final del token: {estado}")
    if estado != "APPROVED":
        return None
    codigo, fuente = llamar(
        "POST",
        "/payment_sources",
        bearer=k["WOMPI_PRIVATE_KEY"],
        cuerpo={
            "type": "NEQUI",
            "token": token_id,
            "customer_email": "prueba@example.com",
            "acceptance_token": aceptacion["acceptance_token"],
            "accept_personal_auth": aceptacion["accept_personal_auth"],
        },
    )
    mostrar("Fuente de pago", codigo, fuente)
    identificador = fuente.get("data", {}).get("id")
    if identificador:
        codigo, lectura = llamar(
            "GET", f"/payment_sources/{identificador}", bearer=k["WOMPI_PRIVATE_KEY"]
        )
        mostrar("Consulta de la fuente (GET /payment_sources/{id})", codigo, lectura)
    return int(identificador) if identificador else None


def cobrar(k: dict[str, str], fuente: int, *, con_firma: bool) -> None:
    referencia = f"aletheia-prueba-{uuid.uuid4().hex[:16]}"
    cuerpo: dict[str, object] = {
        "amount_in_cents": MONTO_CENTAVOS,
        "currency": "COP",
        "customer_email": "prueba@example.com",
        "reference": referencia,
        "payment_source_id": fuente,
    }
    if con_firma:
        cuerpo["signature"] = firma_de_integridad(
            referencia, MONTO_CENTAVOS, "COP", k["WOMPI_INTEGRITY_SECRET"]
        )
    codigo, transaccion = llamar(
        "POST", "/transactions", bearer=k["WOMPI_PRIVATE_KEY"], cuerpo=cuerpo
    )
    mostrar(f"Cobro con la fuente ({'con' if con_firma else 'sin'} firma)", codigo, transaccion)
    identificador = transaccion.get("data", {}).get("id")
    if not identificador:
        return
    for _ in range(15):
        time.sleep(2)
        codigo, consulta = llamar(
            "GET", f"/transactions/{identificador}", bearer=k["WOMPI_PRIVATE_KEY"]
        )
        estado = consulta.get("data", {}).get("status")
        print(f"  consulta: {estado} - {consulta.get('data', {}).get('status_message')}")
        if estado not in ("PENDING", None):
            break
    mostrar("Resultado final del cobro", codigo, consulta)


def main() -> None:
    k = llaves()
    codigo, info = llamar(
        "GET", "/merchants/info", encabezados={"x-merchant-public-key": k["WOMPI_PUBLIC_KEY"]}
    )
    data = info.get("data", {})
    print(f"Contratos de aceptación: HTTP {codigo}, comercio {data.get('name')!r}")
    aceptacion = {
        "acceptance_token": data["presigned_acceptance"]["acceptance_token"],
        "accept_personal_auth": data["presigned_personal_data_auth"]["acceptance_token"],
    }
    print("\n=== 1. Vincular un Nequi que se aprueba, y cobrarle ===")
    fuente = crear_fuente(k, CELULAR_APRUEBA, aceptacion)
    if fuente is None:
        print("\nNo se pudo crear la fuente: no hay nada más que cobrar.")
    else:
        cobrar(k, fuente, con_firma=True)
    print("\n=== 2. Vincular un Nequi que se rechaza ===")
    declinada = crear_fuente(k, CELULAR_DECLINA, aceptacion)
    if declinada is not None:
        cobrar(k, declinada, con_firma=True)
    print("\n=== 3. Un celular cualquiera (resultado de error) ===")
    otra = crear_fuente(k, "3000000000", aceptacion)
    if otra is not None:
        cobrar(k, otra, con_firma=True)


if __name__ == "__main__":
    main()
