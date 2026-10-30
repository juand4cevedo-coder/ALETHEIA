# TT-006 · Prueba técnica de cifrado por flujos y sello de tiempo

Antes de construir el núcleo de evidencia había que comprobar tres cosas: que un archivo de hasta 5 GB se puede cifrar mientras llega, con memoria constante y sin quedar sin cifrar en disco; que la subida multipart se puede leer así desde FastAPI; y que una autoridad de sellado real devuelve un sello RFC 3161 que cualquiera puede verificar. Este código existe para decidir, no para producción: vive fuera de la integración continua y sus bibliotecas están en el grupo `spike` de uv.

Las decisiones quedaron en [ADR-014](../../../docs/adr/adr-014.md) (cifrado por flujos) y [ADR-015](../../../docs/adr/adr-015.md) (sellado de tiempo).

## Cómo repetirla

Desde `backend/`:

```powershell
uv run --group spike pytest spikes/tt006                     # 40 pruebas
uv run --group spike python -m spikes.tt006.medir_tink        # memoria y velocidad de Tink
uv run --group spike python -m spikes.tt006.medir_comparacion # Tink frente a cryptography
uv run --group spike python -m spikes.tt006.sellar            # pide sellos reales (WSL encendido)
```

Verificar un sello guardado con openssl, en Debian:

```bash
openssl ts -verify -data sellos/muestra.txt -in sellos/digicert.tsr -CAfile /etc/ssl/certs/ca-certificates.crt
```

## Resultados por criterio

Medido el 26 de octubre de 2026 en el equipo de desarrollo (Intel Core i5-13450HX, Windows 11 y un contenedor Linux `python:3.14-slim` en el mismo equipo), con Python 3.14.9, Tink 1.16.1 y cryptography 50.0.2.

| Criterio | Resultado |
| --- | --- |
| C1 Ida y vuelta | 0 B, 1 B, los bordes de fragmento ±1 byte y 300 MB se descifran idénticos |
| C2 Memoria al cifrar 2 GiB | 6,7 a 7,7 MiB extra en Windows; 6,2 MiB en Linux |
| C3 Manipulación | Un byte alterado, el último fragmento cortado, fragmentos reordenados y datos asociados de otro caso hacen fallar el descifrado sin entregar ningún byte no verificado |
| C4 Llave envuelta | La llave de caso (131 bytes) se envuelve con RSA-OAEP-256 y RSA de 3072 bits (384 bytes); alterada o ausente, el objeto no se lee |
| C5 Subida por flujo | 300 MB pasan sin abrir nada en la carpeta temporal y con memoria estable; con `UploadFile`, 2 MB ya terminan en un archivo temporal |
| C6 Sello real | DigiCert y Sectigo verifican con rfc3161-client y con `openssl ts -verify -data`; FreeTSA no verifica |
| C7 Velocidad | Tink con huella: 93 MiB/s en Windows y 517 a 872 MiB/s en Linux |

## Cifrado: Tink frente a cryptography

| MiB/s sobre 1 GiB | Windows | Linux |
| --- | --- | --- |
| Solo huella SHA-256 | 915 | 1.309 |
| Solo cifrado Tink | 100 | 2.213 |
| cryptography por fragmentos, con huella | 615 | 1.009 |
| Tink con huella (flujo real) | 82 | 872 |

cryptography no trae cifrado autenticado por flujos: hay que partir el archivo y definir el formato. La versión directa, con un nonce por fragmento, detecta un byte alterado y fragmentos reordenados, pero acepta un archivo cortado en el borde de un fragmento (`test_no_detecta_el_corte_en_el_borde_de_un_fragmento`). Evitarlo exige una marca de último fragmento, que es la construcción que Tink ya trae probada.

El paquete de Tink para Windows es unas 22 veces más lento que el de Linux en el mismo procesador. Producción corre en Linux, así que solo afecta el desarrollo.

## Subida por flujo

FastAPI, a través de Starlette, guarda en un archivo temporal todo archivo de formulario de más de 1 MB antes de llamar al endpoint. `subida.py` recibe la petición sin leer el cuerpo y la procesa por fragmentos con el analizador incremental de python-multipart: `tipo` y `origen` quedan en memoria con un tope, y los bytes del archivo pasan directo a Tink mientras se calcula la huella. El endpoint sigue siendo `def`: desde el hilo donde FastAPI lo ejecuta, cada fragmento se pide al bucle de eventos con `anyio.from_thread.run`. Un archivo mayor al tope del plan recibe 413 y un formulario fuera del orden de API-030 recibe 422.

Las pruebas lo comprueban con un gancho de auditoría de Python que anota todo archivo abierto en la carpeta temporal mientras se atiende la petición.

## Sello de tiempo

| Autoridad | rfc3161-client | openssl | Raíz que ancla la cadena |
| --- | --- | --- | --- |
| DigiCert | Verifica | Verification: OK | DigiCert Assured ID Root CA |
| Sectigo | Verifica | Verification: OK | USERTrust RSA Certification Authority |
| FreeTSA | No verifica | FAILED | Raíz propia, fuera de las raíces públicas |

La solicitud se arma con asn1crypto sobre la huella SHA-256 del archivo tal cual. rfc3161-client vuelve a calcular el hash de lo que recibe, así que con él se sellaría el hash de la huella y openssl no podría verificar el sello contra el archivo (`test_rfc3161_client_sellaria_el_hash_de_la_huella`).

DigiCert y Sectigo envían la lista de certificados fuera del orden que DER exige, y rfc3161-client se niega a leerla. Esa lista no está firmada, así que se reordena en memoria antes de verificar; el sello se guarda tal como llegó y una prueba comprueba que el contenido firmado no cambia.

En `sellos/` quedan la muestra, las solicitudes, los sellos y la raíz que ancla cada cadena. Las pruebas los verifican sin red.

## Lo que queda para producción

- Envolver la llave de caso con la llave RSA de AWS KMS (TT-007).
- Tratar como fallo un error de descifrado a mitad de una descarga (Sprint 4).
- Fijar las raíces de las autoridades y comprobar si DigiCert Trusted Root G4 ancla sola su cadena (Sprint 4).
- Pasar Tink, asn1crypto, rfc3161-client y python-multipart a las dependencias de la aplicación cuando se construya el núcleo de evidencia (Sprint 4).
