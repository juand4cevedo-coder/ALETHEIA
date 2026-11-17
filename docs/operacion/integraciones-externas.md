# Integraciones externas pendientes: acceso y sellado de tiempo

Estado comprobado el 17/11/2026. Este documento registra los pasos necesarios antes de activar servicios externos. La versión de producción v0.4.8 no ofrece ingreso con Google ni Microsoft ni sellos RFC 3161 de evidencias. La exportación de paquetes está integrada en `develop` y aún no se ha publicado.

## Google: HU-008 / DEP-01

1. La persona administradora crea un proyecto de Google Cloud para producción y configura la pantalla de consentimiento OAuth. Registra el dominio público de ALETHEIA y los enlaces públicos de inicio, privacidad y condiciones. Crea un cliente OAuth de tipo aplicación web con la URI de retorno exacta que defina la implementación. Mantiene otro cliente o proyecto para pruebas.
2. La aplicación solicita solo `openid email profile`. El backend usa Authorization Code, PKCE, `state` y `nonce`; valida firma, emisor, audiencia, vencimiento, `nonce` y `email_verified` del ID token. La identidad externa se guarda por `sub`. Compartir un correo no vincula automáticamente una cuenta existente: se exige una vinculación autenticada y expresa.
3. El ID del cliente y su secreto se guardan en el gestor de secretos del entorno, nunca en Git ni en el navegador. Se prueba alta, ingreso, revocación, correo ya existente, rechazo de `state`/`nonce` y retorno desde el dominio real antes de mostrar el botón en producción.

El registro básico de un cliente no justifica contratar servicios de Google Cloud. Antes de activar, la persona administradora debe comprobar en la consola los cargos y requisitos vigentes del proyecto. Los permisos sensibles o restringidos de otras API quedan fuera de este alcance. [Guía OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [política OAuth](https://developers.google.com/identity/protocols/oauth2/policies).

## Microsoft: configuración e historia por definir

1. La persona administradora crea o usa un tenant Microsoft Entra ID Free y registra una aplicación web. Para permitir cuentas de trabajo o escuela y cuentas personales, elige el tipo de cuentas admitidas correspondiente y configura la URI de retorno exacta de producción; usa una aplicación separada para pruebas.
2. La implementación seguirá OIDC con código de autorización, PKCE, `state` y `nonce`. El backend validará firma, emisor, audiencia y vencimiento del ID token. La clave de vínculo incluirá el emisor y el identificador estable del usuario; el correo no bastará para unir cuentas. Se solicitarán únicamente los permisos mínimos de inicio de sesión.
3. Se guardarán las credenciales en el gestor de secretos y se probarán cuentas personales y organizacionales, consentimiento, correo ya existente, cancelación y errores. Solo después se habilitará el botón público.

Microsoft documenta Entra ID Free sin cargo para sus funciones básicas, pero la persona administradora debe revisar las condiciones y cualquier servicio adicional elegido antes de activarlo. El inicio con Microsoft todavía no tiene historia implementada ni registro de aplicación confirmado. [Registro de aplicación](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app), [tipos de cuentas](https://learn.microsoft.com/en-us/security/zero-trust/develop/identity-supported-account-types), [Entra ID Free](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/microsoft-entra-id-free).

## Fecha y hora externa: HU-020 / DEP-04

Un reloj de servidor o la fecha de la base no sustituye un token RFC 3161. El ADR-015 fija una solución técnica probada con DigiCert y Sectigo, pero esa prueba no confirma permiso de uso documental en producción. El ADR-037 prevé anclar la cabeza de la cadena; ese anclaje tampoco está implementado. Los paquetes actuales deben declarar la ausencia de sello externo.

### Alternativas gratuitas y abiertas

| Opción | Qué puede comprobar un tercero | Límite para ALETHEIA |
| --- | --- | --- |
| OpenTimestamps sobre Bitcoin | Que la huella comprometida existía antes del bloque de Bitcoin indicado, una vez completada y verificada la prueba `.ots`. Formato y cliente abiertos; calendarios públicos gratuitos y sin registro. | La prueba inicialmente queda pendiente y puede tardar horas en confirmarse. No afirma una hora exacta de recepción de cada evidencia ni es un token RFC 3161. La verificación autónoma con el cliente requiere un nodo Bitcoin, aunque sea podado. |
| FreeTSA, RFC 3161 | Que una autoridad firmó la huella y declaró una hora; el token se verifica con su cadena publicada. | Raíz propia que el verificador debe instalar explícitamente, sin SLA y con límite de uso. La confianza depende de esa entidad y de su reloj. |
| Registrar solo hashes o fechas en nuestra base | Que los datos conservados coinciden con los hashes calculados hoy. | Un administrador de la misma base podría reescribir historia y hashes; no hay testigo externo. |

**Decisión para ALETHEIA:** usar OpenTimestamps como anclaje adicional y gratuito de la cabeza de custodia por lotes. Guardar la prueba pendiente, intentar completarla más tarde y exportar la prueba completa con instrucciones de verificación independientes. Solo mostrar «anclado en Bitcoin» cuando la confirmación se haya comprobado; mostrar el número de bloque y el límite temporal que demuestra. Esto da un testigo externo distinto de ALETHEIA sin pagar una transacción por evidencia. Mantener HU-020 y DEP-04 para el sello RFC 3161 por evidencia: OpenTimestamps no cumple por sí solo ese criterio de aceptación. El usuario del paquete debe poder distinguir la hora declarada al recibir la evidencia, un eventual token RFC 3161 y el límite temporal demostrado por Bitcoin. Ninguna de esas pruebas certifica por sí sola la procedencia, veracidad o admisibilidad del contenido.

[OpenTimestamps: funcionamiento y calendarios](https://opentimestamps.org/), [cliente: prueba pendiente, actualización y verificación](https://github.com/opentimestamps/opentimestamps-client), [protocolo RFC 3161](https://www.rfc-editor.org/info/rfc3161/).

FreeTSA publica un servicio RFC 3161 gratuito y permite uso comercial, con un máximo de una solicitud por segundo por IP. No ofrece SLA ni plazo de restauración. La prueba TT-006 del proyecto descartó su raíz porque no pertenece a los almacenes públicos de confianza usados allí. Por ello es un candidato para evaluar, no una autoridad aprobada automáticamente. Si se usa, el verificador independiente necesitará la raíz fijada y una política clara de rotación y revocación; no se presentará como sello de una entidad acreditada en Colombia.

Para resolver DEP-04 sin contratar por defecto: obtener y archivar condiciones de uso actuales, URL, límites, política y cadena de confianza del proveedor; verificar un token de prueba contra el archivo original con OpenSSL; comprobar conectividad desde producción, disponibilidad y rotación de certificados; decidir explícitamente si su nivel de confianza y continuidad es suficiente para el producto. La decisión se registra en DEP-04 y se actualiza ADR-015 antes de habilitar `tsa_stamp`. Si ningún servicio gratuito satisface esos criterios, el sello permanece `pending` y se informa al usuario sin prometer fecha externa.

[Política de FreeTSA](https://www.freetsa.org/freetsa.html), [certificados publicados por FreeTSA](https://www.freetsa.org/index_en.php), [ADR-015](../adr/adr-015.md), [ADR-037](../adr/adr-037.md).

## Orden de trabajo

La configuración de cuentas y servicios externos corresponde a la persona administradora y no requiere compartir credenciales por chat. Mientras se realiza, el equipo puede preparar y probar los adaptadores y pantallas en entornos de prueba. Ninguna integración se marca como disponible en la documentación de usuario o en los nueve documentos de Drive hasta comprobarla en producción. La matriz maestra de trazabilidad se conserva sin cambios.
