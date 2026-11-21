# Integraciones externas pendientes: acceso y sellado de tiempo

La versión v0.5.0 incluye exportación de paquetes y sellado por evidencia mediante un trabajador. El inicio de sesión con Google sigue pendiente; Microsoft quedó fuera del alcance por decisión del proyecto. La validación operativa del proveedor de sellado y del ciclo completo de preservación se registra en DEP-04, HU-020 y HU-025.

## Google: HU-008 / DEP-01

1. La persona administradora crea un proyecto de Google Cloud para producción y configura la pantalla de consentimiento OAuth. Registra el dominio público de ALETHEIA y los enlaces públicos de inicio, privacidad y condiciones. Crea un cliente OAuth de tipo aplicación web con la URI de retorno exacta que defina la implementación. Mantiene otro cliente o proyecto para pruebas.
2. La aplicación solicita solo `openid email profile`. El backend usa Authorization Code, PKCE, `state` y `nonce`; valida firma, emisor, audiencia, vencimiento, `nonce` y `email_verified` del ID token. La identidad externa se guarda por `sub`. Compartir un correo no vincula automáticamente una cuenta existente: se exige una vinculación autenticada y expresa.
3. El ID del cliente y su secreto se guardan en el gestor de secretos del entorno, nunca en Git ni en el navegador. Se prueba alta, ingreso, revocación, correo ya existente, rechazo de `state`/`nonce` y retorno desde el dominio real antes de mostrar el botón en producción.

El registro básico de un cliente no justifica contratar servicios de Google Cloud. Antes de activar, la persona administradora debe comprobar en la consola los cargos y requisitos vigentes del proyecto. Los permisos sensibles o restringidos de otras API quedan fuera de este alcance. [Guía OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [política OAuth](https://developers.google.com/identity/protocols/oauth2/policies).

## Fecha y hora externa: HU-020 / DEP-04

El trabajador solicita un token RFC 3161 a DigiCert y usa Sectigo como respaldo ante indisponibilidad. La aplicación verifica el token antes de registrar el sello. El ZIP incorpora el token si existe y el manifiesto indica el estado de cada evidencia. El anclaje externo de la cabeza de custodia permanece pendiente. La integración técnica no acredita autorización de uso documental ni continuidad del servicio.

### Alternativas gratuitas y abiertas

| Opción | Qué puede comprobar un tercero | Límite para ALETHEIA |
| --- | --- | --- |
| OpenTimestamps sobre Bitcoin | Que la huella comprometida existía antes del bloque de Bitcoin indicado, una vez completada y verificada la prueba `.ots`. Formato y cliente abiertos; calendarios públicos gratuitos y sin registro. | La prueba inicialmente queda pendiente y puede tardar horas en confirmarse. No afirma una hora exacta de recepción de cada evidencia ni es un token RFC 3161. La verificación autónoma con el cliente requiere un nodo Bitcoin, aunque sea podado. |
| FreeTSA, RFC 3161 | Que una autoridad firmó la huella y declaró una hora; el token se verifica con su cadena publicada. | Raíz propia que el verificador debe instalar explícitamente, sin SLA y con límite de uso. La confianza depende de esa entidad y de su reloj. |
| Registrar solo hashes o fechas en nuestra base | Que los datos conservados coinciden con los hashes calculados hoy. | Un administrador de la misma base podría reescribir historia y hashes; no hay testigo externo. |

ADR-037 prevé sellar la cabeza de custodia mediante RFC 3161 al exportar y una vez al día si la cadena cambia. Ese anclaje sigue pendiente. OpenTimestamps se contempla como testigo adicional por lotes. Su incorporación requeriría guardar la prueba pendiente, actualizarla y comprobar su confirmación antes de mostrar un número de bloque. El manifiesto y el informe deben distinguir la hora de recepción, el sello por evidencia y la prueba externa de la cabeza de custodia.

[OpenTimestamps: funcionamiento y calendarios](https://opentimestamps.org/), [cliente: prueba pendiente, actualización y verificación](https://github.com/opentimestamps/opentimestamps-client), [protocolo RFC 3161](https://www.rfc-editor.org/info/rfc3161/).

FreeTSA publica un servicio RFC 3161 gratuito y permite uso comercial, con un máximo de una solicitud por segundo por IP. No ofrece SLA ni plazo de restauración. La prueba TT-006 del proyecto descartó su raíz porque no pertenece a los almacenes públicos de confianza usados allí. Por ello es un candidato para evaluar, no una autoridad aprobada automáticamente. Si se usa, el verificador independiente necesitará la raíz fijada y una política clara de rotación y revocación; no se presentará como sello de una entidad acreditada en Colombia.

Para resolver DEP-04 sin contratar por defecto: obtener y archivar condiciones de uso actuales, URL, límites, política y cadena de confianza del proveedor; verificar un token de prueba contra el archivo original con OpenSSL; comprobar conectividad desde producción, disponibilidad y rotación de certificados; decidir explícitamente si su nivel de confianza y continuidad es suficiente para el producto. La decisión se registra en DEP-04 y se actualiza ADR-015 para respaldar la operación de `tsa_stamp`. Si todavía no hay un token verificado, se informa el estado real de la tarea sin prometer una fecha externa.

[Política de FreeTSA](https://www.freetsa.org/freetsa.html), [certificados publicados por FreeTSA](https://www.freetsa.org/index_en.php), [ADR-015](../adr/adr-015.md), [ADR-037](../adr/adr-037.md).

## Verificación de preservación

Use un espacio de pruebas y un archivo de muestra. El navegador y el trabajador deben usar el mismo entorno.

1. Cargue el archivo como evidencia de un caso de prueba. Compare su SHA-256 local con el detalle. Si el trabajador obtiene un sello, compruebe que el estado cambie a sellado y que la cadena incluya el evento correspondiente.
2. Como abogado autorizado, solicite el paquete desde la pestaña Paquete. Cuando esté listo, descargue el ZIP y compare el original y su huella con `manifest.json`. Compruebe que el informe PDF y la cadena exportada correspondan al caso.
3. Si hay un token de evidencia, verifíquelo contra el original con la cadena de confianza aprobada. Compruebe el estado de anclaje por separado en el manifiesto y en el informe.
4. Confirme que un asistente no pueda solicitar el paquete y que el enlace venza a las 24 horas.

## Orden de trabajo

La configuración de cuentas y servicios externos corresponde a la persona administradora y no requiere compartir credenciales por chat. Mientras se realiza, el equipo puede preparar y probar los adaptadores y pantallas en entornos de prueba. Ninguna integración se marca como disponible en la documentación de usuario o en los documentos de Drive hasta comprobarla en producción. La matriz maestra de trazabilidad se conserva sin cambios.
