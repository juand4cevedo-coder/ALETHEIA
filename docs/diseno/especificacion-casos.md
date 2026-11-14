# Casos: abrir un caso y consultar los casos (HU-015 y HU-017)

| Campo | Contenido |
| --- | --- |
| Historias | HU-015 Crear un caso (#86, 3 puntos) y HU-017 Consultar mis casos (#88, 2 puntos) |
| Estado | Especificación vigente desde el 10/11/2026 |
| Decisiones que respeta | ADR-005 (llave por caso), ADR-014 (Tink por flujos), ADR-017 (AWS KMS), ADR-023 (espacio de trabajo oscuro), ADR-037 (hash de custodia calculado por la base) |

## 1. Objetivo

Que un abogado abra un caso con su identidad procesal real y que el caso nazca protegido: con su propia llave de cifrado, con quien lo abre como miembro y con el primer eslabón de su cadena de custodia. Que cada persona vea los casos en los que es miembro y sepa de un vistazo si su custodia está en orden.

Principio de diseño: un abogado no abre una carpeta, abre un expediente con valor probatorio. Cada pantalla responde primero si la evidencia sigue íntegra y si lo puede demostrar. Nada en la interfaz afirma una garantía que el sistema no haya comprobado.

## 2. Alcance

Dentro:

- Crear un caso (`POST /api/v1/cases`), con llave de datos envuelta por KMS, membresía de quien lo crea, evento `case_created` y registro de auditoría.
- Campos nuevos y opcionales del caso: número de radicación, despacho y especialidad (migración 0014).
- Consultar un caso (`GET /api/v1/cases/{case_id}`) con su primer evento de custodia y su equipo, para la pantalla de destino.
- Listar los casos de la persona (`GET /api/v1/cases`), con filtros por estado y conteos por caso (HU-017).
- Pantallas: «Antes del primer caso», «Abrir un caso», «El caso recién abierto» y «Libro de casos». Entrada «Casos» en el menú lateral.

Fuera (cada uno llega con su historia):

- Editar los datos del caso: no hay acción de custodia para ello y agregarla exige su propia decisión (RN-006). La pantalla no muestra «Editar datos».
- Asignar miembros (HU-016), subir evidencia (HU-018), sellos (HU-020), verificar la cadena (HU-024) y paquetes (HU-025). Sus zonas no se muestran hasta que existan.
- Búsqueda global con Ctrl K: se muestra solo cuando exista una búsqueda real; en esta entrega el campo de la lista filtra los casos cargados por título, radicado o despacho.

## 3. Datos

### 3.1 Migración 0014 `datos_procesales_del_caso`

Agrega a `cases` tres columnas opcionales:

| Columna | Tipo | Regla |
| --- | --- | --- |
| `filing_number` | `text` | `filing_number ~ '^[0-9]{23}$'`. Se guarda solo con dígitos; la interfaz lo muestra por bloques |
| `court` | `text` | `char_length(court) BETWEEN 1 AND 160` |
| `practice_area` | `text` | Lista cerrada: `civil`, `commercial`, `family`, `labor`, `criminal`, `administrative`, `constitutional`, `other` |

Un índice único parcial `(organization_id, filing_number) WHERE filing_number IS NOT NULL` evita abrir dos veces el mismo proceso en una organización. La migración es aditiva y reversible: solo agrega columnas que admiten nulo, sin reescribir la tabla.

No se agregan campos para las partes del proceso. La Ley 1581 de 2012 pide recoger solo lo necesario; el título es libre y el formulario recuerda no incluir datos sensibles.

### 3.2 El evento `case_created`

`details` lleva solo `{"key_version": "<versión>"}`. El título y los datos procesales no entran en la cadena: la cadena es inmutable y un dato personal escrito en ella no se podría corregir ni eliminar.

## 4. Backend

### 4.1 Adaptador de llaves `app/adapters/keys.py`

```text
class KeyWrapper(Protocol):
    def wrap(self, plaintext: bytes) -> WrappedKey      # WrappedKey(ciphertext, key_version)
    def unwrap(self, wrapped: WrappedKey) -> bytes
```

- `KmsKeyWrapper` (producción): `Encrypt` y `Decrypt` de AWS KMS sobre `alias/aletheia-prod-maestra` con `RSAES_OAEP_SHA_256`, usando el rol de la instancia. `key_version` es el ARN de la llave que devuelve KMS.
- `LocalKeyWrapper` (desarrollo y pruebas): RSA-3072 con OAEP-SHA-256 sobre una llave PEM leída de `ALETHEIA_LOCAL_KEY_PATH`, fuera del repositorio. `key_version` es `local:` más los primeros 16 caracteres hexadecimales del SHA-256 de la llave pública en DER. Las pruebas generan una llave efímera.
- La elección depende solo de `ALETHEIA_ENVIRONMENT`, como el correo: en `production` se usa siempre KMS y la configuración rechaza `ALETHEIA_LOCAL_KEY_PATH`.
- El keyset de Tink del caso usa la plantilla de cifrado por flujos AES-256-GCM-HKDF con fragmentos de 1 MB (ADR-014). Se serializa en binario, se envuelve y se descarta de la memoria apenas termina la operación.
- `tink` y `cryptography` pasan del grupo `spike` a las dependencias de la aplicación.

### 4.2 Servicio `app/services/cases.py`

`create_case(session, principal, data, key_wrapper, *, client_ip, user_agent) -> Case`

1. Comprueba fuera de toda transacción: rol en `owner`, `admin` o `lawyer` (RN-008); correo verificado (CA-HU-006-02); organización `active`.
2. Genera y envuelve la llave **antes de abrir la transacción**: ninguna llamada de red con una transacción abierta (lección de TT-017).
3. En una sola transacción, bajo el contexto de RLS de la organización: inserta el caso, la membresía de quien lo crea, el evento `case_created` (el trigger calcula su `seq` y su hash) y la entrada de `audit_log` con la IP y el agente anonimizables (RN-027).
4. Si algo falla, no queda ninguna fila. Si falla KMS, no se abre la transacción.

Errores propios: `NotAllowedToCreateCasesError`, `EmailNotVerifiedError`, `OrganizationNotActiveError` (el de `members`) y `FilingNumberTakenError`.

`list_cases(session, principal, *, status, cursor, limit)` devuelve los casos donde la persona es miembro, ordenados por última actividad descendente, con paginación por cursor (IDX-006) y, por caso, el número de evidencias por tipo declarado (solo los tipos que tienen alguna), el número de miembros, sus iniciales, el último evento (acción, actor y hora; nulo si el caso no tiene eventos, y la pantalla muestra «Sin actividad registrada») y las acciones de los últimos cinco eventos. Usa una consulta con agregados, sin N+1. Los totales de la franja (casos por estado, evidencias, sellos pendientes y eventos) salen de una consulta aparte.

`get_case(session, principal, case_id)` devuelve el caso, su equipo y sus últimos eventos. Un caso que no existe o del que la persona no es miembro responde lo mismo: 404 con MSG-011.

### 4.3 Rutas `app/api/cases.py`

| Método y ruta | Respuesta | Errores |
| --- | --- | --- |
| `POST /api/v1/cases` | `201` `CaseOut` y `Location` | `403` MSG-010 (rol), `403` correo sin verificar, `409` organización en solo lectura, `409` radicado ya usado, `422` validación, `503` si KMS no responde |
| `GET /api/v1/cases?status=open\|closed\|all&cursor=&limit=` | `200` `CasePage` con `items`, `next_cursor` y `totals` | `401` |
| `GET /api/v1/cases/{case_id}` | `200` `CaseDetail` | `404` MSG-011 |

- Entrada `CaseCreate`: `title` (1 a 160, sin espacios al borde), `filing_number` (opcional; se aceptan espacios y guiones y se guardan solo los dígitos, que deben ser 23), `court` (1 a 160) y `practice_area` de la lista, ambos opcionales, e `internal_reference` (1 a 80, opcional). Los campos extra se rechazan.
- Todas las respuestas llevan `Cache-Control: no-store`. La creación pasa por `SameOriginMiddleware`.
- Se regenera `backend/openapi.json` y el cliente `frontend/src/api/generated`.

## 5. Interfaz

Dirección «Sala oscura, refinada» (ADR-023). Los valores nuevos entran como tokens en `tokens.css` (superficies `ink-925`, `ink-850` e `ink-1000`, oro de aviso de privacidad y sombras); ningún valor suelto en los módulos.

### 5.1 Componentes nuevos en `components/ui`

- `PageHeader`: etiqueta superior, título, texto de apoyo y acciones.
- `StatusBadge`: estados `ok`, `pending`, `muted` y `closed`, con punto y texto; el color nunca es el único indicador.
- `FilingNumber`: muestra un radicado por bloques (`11001 31 05 003 2026 00143 00`) en monoespaciada; con `breakdown` despliega sus ocho partes con su nombre.
- `ChainStrip`: rombos de los últimos eventos; ámbar si hay un sello pendiente. Tiene un texto alternativo que describe los eventos.
- `EmptyState`: título, texto y acciones, con un panel lateral opcional.

### 5.2 Pantallas y rutas

| Ruta | Pantalla | Notas |
| --- | --- | --- |
| `/app/casos` | Libro de casos o, sin casos, «Antes del primer caso» | Franja de custodia, segmentos Abiertos/Cerrados/Todos con conteo, filtro local por texto y tabla. La columna de integridad dice «Sin verificar» en gris hasta HU-024 |
| `/app/casos/nuevo` | Abrir un caso | Formulario a la izquierda y vista previa del registro de apertura a la derecha. Radicado validado al escribir y desglosado. Aviso de privacidad. Sin indicador de pasos hasta que existan HU-016 y HU-018 |
| `/app/casos/:id` | El caso recién abierto | Encabezado con radicado, título y chips de especialidad, despacho y apertura. Pestañas solo de lo que existe. Panel de cadena con el evento 1 y su hash abreviado. Panel de equipo |

- El asistente ve el libro de casos sin el botón «Abrir caso» y, sin casos, el texto «Los casos los abre un abogado, el administrador o el propietario. Cuando lo asignen a uno, aparecerá aquí».
- Con el correo sin verificar, el botón no se oculta: abre un aviso que explica por qué y ofrece reenviar el enlace (`ResendVerification`).
- Las horas se muestran en hora de Colombia (`America/Bogota`) y la hora exacta del evento lleva «(UTC−5)».
- El formulario conserva lo escrito si la API rechaza el envío, y lleva el foco al primer campo con error.
- En pantallas de 900 px o menos, la tabla pasa a tarjetas apiladas y la vista previa del registro de apertura queda debajo del formulario.

### 5.3 Textos

En español de Colombia y de «usted». ALETHEIA preserva y documenta; ningún texto dice que certifica ni que determina la validez de una prueba. Los mensajes de error usan el catálogo existente (MSG-010 y MSG-011) y estos nuevos:

- Correo sin verificar: «Verifique su correo para abrir casos. Le enviamos un enlace al crear la cuenta; si venció, pida uno nuevo».
- Radicado inválido: «El número de radicación tiene 23 dígitos. Revise que no falte ni sobre ninguno».
- Radicado repetido: «Ya hay un caso con este número de radicación en su organización».
- KMS no disponible: «No pudimos preparar la llave de cifrado del caso. Inténtelo de nuevo en unos minutos».

## 6. Pruebas

Backend, con la base de pruebas real:

- Crean caso el propietario, el administrador y el abogado; el asistente recibe 403 (CA-HU-015-02).
- Correo sin verificar, 403; organización en solo lectura, 409; radicado repetido, 409; radicado de 22 o 24 dígitos, 422.
- Quien crea queda como miembro y existe un solo evento `case_created`, con `seq` 1, cuyo hash recalcula el verificador independiente (CA-HU-015-01).
- La llave envuelta se recupera idéntica con `unwrap` y no se puede leer si se altera un byte.
- Si `wrap` falla, no queda ninguna fila en `cases`, `case_members`, `custody_events` ni `audit_log`.
- Aislamiento: desde otra organización, el caso no aparece en la lista y su detalle responde 404.
- La lista solo trae los casos donde la persona es miembro, pagina por cursor y no hace una consulta por caso.
- La configuración de producción rechaza `ALETHEIA_LOCAL_KEY_PATH`.
- La migración 0014 sube y baja limpia.

Frontend, con Vitest y axe:

- Cada pantalla sin violaciones de axe.
- El radicado se desglosa y valida al escribir; con un error de la API, el formulario conserva los datos y enfoca el campo.
- El asistente no ve el botón; con el correo sin verificar, el botón abre el aviso.
- Tras crear el caso se llega a `/app/casos/:id` con el evento 1.

## 7. Entrega

Dos ramas y dos PR contra `develop`, en orden: `feature/HU-015-crear-un-caso` (migración, adaptador, creación, detalle y las pantallas de abrir y del caso) y `feature/HU-017-consultar-mis-casos` (lista, franja y libro de casos). La definición de terminado de cada issue aplica completa. Si hace falta un ADR, lleva el número 042.
