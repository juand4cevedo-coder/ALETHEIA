"""Pasarela de pagos Wompi (HU-027, ADR-010): Nequi para el primer cobro de una suscripción.

Documentación oficial: https://docs.wompi.co/en/docs/colombia/. Toda llamada autenticada usa
la llave privada como Bearer, salvo la consulta de tokens de aceptación, que usa la llave
pública en el encabezado `x-merchant-public-key`. La firma de integridad que exige Wompi al
crear una transacción es SHA256 de `reference + amount_in_cents + currency + integrity_secret`,
en ese orden y sin separadores (verificado contra el vector de prueba de la guía de Checkout
Web). La firma de los webhooks es SHA256 de los valores de `signature.properties`, en el orden
que la propia notificación indica, seguidos del `timestamp` (entero) y del secreto de eventos;
Wompi advierte que esa lista de propiedades puede cambiar, así que nunca se asume fija aquí.
"""

import hashlib
import hmac
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Final

from app.core.config import Settings

_SANDBOX_URL: Final = "https://sandbox.wompi.co/v1"
_PRODUCTION_URL: Final = "https://production.wompi.co/v1"
_ESPERA_SEGUNDOS: Final = 15
_CHECKOUT_WEB_URL: Final = "https://checkout.wompi.co/p/"
# Los identificadores de Wompi son letras, números, guiones y guiones bajos (por ejemplo
# 1292-1602113476-10985). Cualquier otra cosa no es un identificador y nunca llega a la URL.
_ID_DE_TRANSACCION: Final = re.compile(r"[A-Za-z0-9_-]{1,100}")


class WompiNoConfiguradoError(RuntimeError):
    """Faltan las credenciales de Wompi en la configuración."""


class WompiRechazadoError(RuntimeError):
    """Wompi respondió que la solicitud está mal formada; reintentarla igual no sirve."""


class WompiNoDisponibleError(RuntimeError):
    """Wompi no respondió o falló de su lado; vale la pena reintentar."""


@dataclass(frozen=True, slots=True)
class Credenciales:
    public_key: str
    private_key: str
    integrity_secret: str
    events_secret: str
    base_url: str


def credenciales_de(settings: Settings) -> Credenciales:
    if (
        settings.wompi_public_key is None
        or settings.wompi_private_key is None
        or settings.wompi_integrity_secret is None
        or settings.wompi_events_secret is None
    ):
        raise WompiNoConfiguradoError("Faltan las variables ALETHEIA_WOMPI_* de configuración.")
    return Credenciales(
        public_key=settings.wompi_public_key,
        private_key=settings.wompi_private_key.get_secret_value(),
        integrity_secret=settings.wompi_integrity_secret.get_secret_value(),
        events_secret=settings.wompi_events_secret.get_secret_value(),
        base_url=_PRODUCTION_URL if settings.environment == "production" else _SANDBOX_URL,
    )


def _llamar(
    url: str,
    *,
    cuerpo: dict[str, object] | None = None,
    metodo: str = "GET",
    bearer: str | None = None,
    encabezados: dict[str, str] | None = None,
) -> dict[str, Any]:
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    todos = {"Content-Type": "application/json", "Accept": "application/json"}
    if bearer is not None:
        todos["Authorization"] = f"Bearer {bearer}"
    if encabezados is not None:
        todos.update(encabezados)
    peticion = urllib.request.Request(url, data=datos, headers=todos, method=metodo)  # noqa: S310
    try:
        with urllib.request.urlopen(peticion, timeout=_ESPERA_SEGUNDOS) as respuesta:  # noqa: S310
            cuerpo_respuesta: dict[str, Any] = json.loads(respuesta.read())
            return cuerpo_respuesta
    except urllib.error.HTTPError as exc:
        # El cuerpo puede contener datos de la transacción o del pagador. Se consume para
        # liberar la conexión, pero nunca se propaga a excepciones ni registros.
        exc.read()
        if exc.code in (400, 401, 404, 422):
            raise WompiRechazadoError(f"Wompi respondió {exc.code}") from exc
        raise WompiNoDisponibleError(f"Wompi respondió {exc.code}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise WompiNoDisponibleError(f"Wompi no respondió: {exc}") from exc
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise WompiNoDisponibleError(f"La respuesta de Wompi no se pudo leer: {exc}") from exc


@dataclass(frozen=True, slots=True)
class TokensDeAceptacion:
    acceptance_token: str
    acceptance_permalink: str
    accept_personal_auth: str
    personal_auth_permalink: str


def tokens_de_aceptacion(creds: Credenciales) -> TokensDeAceptacion:
    """GET /merchants/info con la llave pública: los dos contratos que exige la ley de
    habeas data, vigentes al momento de la consulta, con el enlace a su texto para que la
    persona los lea antes de aceptarlos (RF-038, RN-022: la aceptación es explícita, nunca
    implícita por el solo hecho de pagar)."""
    respuesta = _llamar(
        f"{creds.base_url}/merchants/info",
        encabezados={"x-merchant-public-key": creds.public_key},
    )
    data = respuesta["data"]
    return TokensDeAceptacion(
        acceptance_token=data["presigned_acceptance"]["acceptance_token"],
        acceptance_permalink=data["presigned_acceptance"]["permalink"],
        accept_personal_auth=data["presigned_personal_data_auth"]["acceptance_token"],
        personal_auth_permalink=data["presigned_personal_data_auth"]["permalink"],
    )


def firma_de_integridad(reference: str, amount_in_cents: int, currency: str, secreto: str) -> str:
    cadena = f"{reference}{amount_in_cents}{currency}{secreto}"
    return hashlib.sha256(cadena.encode()).hexdigest()


def url_de_checkout_web(
    creds: Credenciales,
    *,
    reference: str,
    amount_in_cents: int,
    redirect_url: str,
    customer_email: str,
    vigencia: timedelta,
    ahora: datetime | None = None,
) -> tuple[str, datetime]:
    """La dirección del Checkout Web de Wompi para una transacción, y cuándo vence.

    La persona paga en la página de Wompi con tarjeta, PSE, Nequi u otros medios que el comercio
    tenga habilitados; los datos de pago nunca pasan por ALETHEIA. La firma de integridad cubre la
    referencia, el monto, la moneda, la fecha de vencimiento y el secreto, en ese orden: Wompi la
    exige y rechaza una dirección alterada. La redirección de regreso solo informa; lo que activa
    el plan es el webhook o la consulta firmada con la llave privada."""
    vence = (ahora or datetime.now(UTC)) + vigencia
    expiracion = vence.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    cadena = f"{reference}{amount_in_cents}COP{expiracion}{creds.integrity_secret}"
    firma = hashlib.sha256(cadena.encode()).hexdigest()
    parametros = {
        "public-key": creds.public_key,
        "currency": "COP",
        "amount-in-cents": str(amount_in_cents),
        "reference": reference,
        "signature:integrity": firma,
        "redirect-url": redirect_url,
        "expiration-time": expiracion,
        "customer-data:email": customer_email,
    }
    return f"{_CHECKOUT_WEB_URL}?{urllib.parse.urlencode(parametros)}", vence


@dataclass(frozen=True, slots=True)
class Transaccion:
    id: str
    status: str
    reference: str
    amount_in_cents: int
    payment_method_type: str | None = None


def crear_transaccion_nequi(
    creds: Credenciales,
    *,
    reference: str,
    amount_in_cents: int,
    customer_email: str,
    phone_number: str,
    acceptance_token: str,
    accept_personal_auth: str,
) -> Transaccion:
    """POST /transactions con payment_method NEQUI. Siempre vuelve en PENDING (RF-038): el
    cliente aprueba con una notificación push de Nequi y el estado final llega por webhook.

    acceptance_token y accept_personal_auth deben ser los que la persona aceptó de verdad,
    nunca unos que este adaptador pida por su cuenta (RN-022)."""
    cuerpo: dict[str, object] = {
        "acceptance_token": acceptance_token,
        "accept_personal_auth": accept_personal_auth,
        "amount_in_cents": amount_in_cents,
        "currency": "COP",
        "customer_email": customer_email,
        "payment_method": {"type": "NEQUI", "phone_number": phone_number},
        "reference": reference,
        "signature": firma_de_integridad(reference, amount_in_cents, "COP", creds.integrity_secret),
    }
    respuesta = _llamar(
        f"{creds.base_url}/transactions", cuerpo=cuerpo, metodo="POST", bearer=creds.private_key
    )
    data = respuesta["data"]
    return Transaccion(
        id=data["id"],
        status=data["status"],
        reference=data["reference"],
        amount_in_cents=data["amount_in_cents"],
    )


def crear_token_nequi(creds: Credenciales, phone_number: str) -> str:
    """POST /tokens/nequi con la llave pública: Wompi manda a la persona una notificación para que
    apruebe la vinculación en su celular. Devuelve el identificador del token, que queda en trámite
    hasta que la persona aprueba (PENDING)."""
    respuesta = _llamar(
        f"{creds.base_url}/tokens/nequi",
        cuerpo={"phone_number": phone_number},
        metodo="POST",
        bearer=creds.public_key,
    )
    token = str(respuesta["data"]["id"])
    if _ID_DE_TRANSACCION.fullmatch(token) is None:
        raise WompiNoDisponibleError("Wompi devolvió un identificador de token que no se reconoce.")
    return token


def consultar_token_nequi(creds: Credenciales, token: str) -> str:
    """GET /tokens/nequi/{token}: el estado de la vinculación (PENDING, APPROVED o DECLINED). El
    token sale de la base, no de la petición, y se valida igual antes de ir a la ruta."""
    if _ID_DE_TRANSACCION.fullmatch(token) is None:
        raise WompiRechazadoError("El identificador del token no es válido.")
    ruta = urllib.parse.quote(token, safe="")
    respuesta = _llamar(f"{creds.base_url}/tokens/nequi/{ruta}", bearer=creds.public_key)
    return str(respuesta["data"]["status"])


def crear_fuente_nequi(
    creds: Credenciales,
    *,
    token: str,
    customer_email: str,
    acceptance_token: str,
    accept_personal_auth: str,
) -> int:
    """POST /payment_sources con la llave privada: con el token aprobado crea la fuente de pago.
    Devuelve su identificador, que es lo único que ALETHEIA guarda."""
    respuesta = _llamar(
        f"{creds.base_url}/payment_sources",
        cuerpo={
            "type": "NEQUI",
            "token": token,
            "customer_email": customer_email,
            "acceptance_token": acceptance_token,
            "accept_personal_auth": accept_personal_auth,
        },
        metodo="POST",
        bearer=creds.private_key,
    )
    data = respuesta["data"]
    if data.get("status") != "AVAILABLE":
        raise WompiRechazadoError("Wompi no dejó disponible la fuente de pago.")
    return int(data["id"])


def cobrar_con_fuente(
    creds: Credenciales,
    *,
    source_id: int,
    amount_in_cents: int,
    reference: str,
    customer_email: str,
) -> Transaccion:
    """POST /transactions con una fuente de pago vinculada: el cobro de una renovación automática.
    Con una fuente que no es tarjeta, Wompi no pide `payment_method`. El resultado definitivo llega
    por el aviso de Wompi o por su consulta firmada, como en cualquier otro pago."""
    cuerpo = {
        "amount_in_cents": amount_in_cents,
        "currency": "COP",
        "customer_email": customer_email,
        "reference": reference,
        "payment_source_id": source_id,
        "signature": firma_de_integridad(reference, amount_in_cents, "COP", creds.integrity_secret),
    }
    respuesta = _llamar(
        f"{creds.base_url}/transactions", cuerpo=cuerpo, metodo="POST", bearer=creds.private_key
    )
    data = respuesta["data"]
    return Transaccion(
        id=data["id"],
        status=data["status"],
        reference=data["reference"],
        amount_in_cents=data["amount_in_cents"],
        payment_method_type=data.get("payment_method_type"),
    )


def consultar_transaccion(creds: Credenciales, transaction_id: str) -> Transaccion:
    """GET /transactions/{id}: la versión de la transacción en la que Wompi manda, no la que
    venga en un webhook. El webhook solo avisa que algo cambió (HU-027); nunca se activa un
    plan con datos que no salgan de aquí o de una respuesta de POST /transactions."""
    if _ID_DE_TRANSACCION.fullmatch(transaction_id) is None:
        raise WompiRechazadoError("El identificador de la transacción no es válido.")
    ruta = urllib.parse.quote(transaction_id, safe="")
    respuesta = _llamar(f"{creds.base_url}/transactions/{ruta}", bearer=creds.private_key)
    data = respuesta["data"]
    return Transaccion(
        id=data["id"],
        status=data["status"],
        reference=data["reference"],
        amount_in_cents=data["amount_in_cents"],
        payment_method_type=data.get("payment_method_type"),
    )


def consultar_por_referencia(creds: Credenciales, reference: str) -> Transaccion | None:
    """GET /transactions?reference=: la transacción más reciente de una referencia propia.
    La referencia sale de la base (la generó este servidor), nunca de la petición, y viaja
    codificada como parámetro de consulta; la ruta es fija."""
    consulta = urllib.parse.urlencode({"reference": reference})
    respuesta = _llamar(f"{creds.base_url}/transactions?{consulta}", bearer=creds.private_key)
    filas = [fila for fila in respuesta.get("data", []) if fila.get("reference") == reference]
    if not filas:
        return None
    # Una referencia puede tener varios intentos: manda el más reciente.
    fila = max(filas, key=lambda f: str(f.get("created_at", "")))
    return Transaccion(
        id=fila["id"],
        status=fila["status"],
        reference=fila["reference"],
        amount_in_cents=fila["amount_in_cents"],
        payment_method_type=fila.get("payment_method_type"),
    )


def _valor_de(objeto: dict[str, Any], ruta: str) -> object:
    actual: object = objeto
    for parte in ruta.split("."):
        if not isinstance(actual, dict) or parte not in actual:
            raise KeyError(ruta)
        actual = actual[parte]
    return actual


def firma_de_webhook_es_valida(payload: dict[str, Any], events_secret: str) -> bool:
    """Compara el checksum recibido contra el calculado con los campos que la propia
    notificación lista en signature.properties, en ese orden, más el timestamp y el secreto
    de eventos. Una notificación sin esos campos, o que no cuadra, se trata como inválida."""
    firma = payload.get("signature")
    timestamp = payload.get("timestamp")
    data = payload.get("data")
    if not isinstance(firma, dict) or not isinstance(data, dict) or timestamp is None:
        return False
    propiedades = firma.get("properties")
    checksum = firma.get("checksum")
    if not isinstance(propiedades, list) or not propiedades or not isinstance(checksum, str):
        return False
    try:
        valores = "".join(str(_valor_de(data, str(propiedad))) for propiedad in propiedades)
    except KeyError:
        return False
    cadena = f"{valores}{timestamp}{events_secret}"
    calculado = hashlib.sha256(cadena.encode()).hexdigest()
    return hmac.compare_digest(calculado.lower(), checksum.lower())
