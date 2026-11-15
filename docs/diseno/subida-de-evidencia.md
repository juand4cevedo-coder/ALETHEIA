# Subida de evidencia (HU-018)

`POST /api/v1/cases/{case_id}/evidences` recibe `multipart/form-data` con los campos
`tipo`, `origen` y `archivo`, en ese orden. El cliente debe enviar la cookie de sesión y
`X-Aletheia-Request: 1`. Puede subir quien tenga una asignación vigente al caso y el
permiso `cases.upload_evidence`: propietario, administrador, abogado o asistente de su
despacho. La cuenta administradora de plataforma no entra a los casos. Un no miembro
recibe 403.

Antes de leer el cuerpo se verifica membresía, estado abierto del caso, estado activo del
despacho y límites del plan. Luego se cierra la transacción de lectura, se desenvuelve la
llave del caso y se analiza el formulario por fragmentos. La huella SHA-256 se calcula
sobre los bytes originales en la misma pasada en que Tink los cifra con
AES256_GCM_HKDF_1MB. Los datos asociados contienen los identificadores del caso y de la
evidencia. El contenido cifrado se envía a S3 por partes de 8 MiB en producción. En
desarrollo se escribe en un archivo cifrado temporal que se publica solo al terminar.
No se crea un archivo temporal con el contenido sin cifrar.

El tamaño del archivo se compara mientras llegan los bytes con el menor valor entre el
máximo por archivo del plan y el espacio aún disponible. Una carga excesiva responde 413
sin seguir leyendo el resto. Cuando la carga termina, se publica el objeto cifrado y se
vuelven a comprobar permisos, caso, despacho y cuota bajo bloqueos de fila. La evidencia,
el evento `evidence_uploaded` y el incremento del almacenamiento se confirman en una
sola transacción. Si esa transacción falla, se elimina el objeto. Si el formulario se
corta o se rechaza, se elimina la carga parcial; no queda evidencia, evento ni consumo
de cuota.

El campo `detected_type` se infiere de la cabecera del archivo recibido; no se toma del
`Content-Type` enviado por el navegador. El origen es una declaración de la persona que
sube el archivo, no una comprobación independiente. La respuesta 201 contiene el ID, la
huella SHA-256, el tamaño y `tsa_status: pending`. El sello de tiempo y la descarga de
evidencias corresponden a HU-020 y HU-022.

HU-019 añade `GET /api/v1/cases/{case_id}/evidences`: devuelve, por páginas de 20 (máximo
50), los metadatos de los archivos de un caso asignado. El cursor es el UUID de la última
evidencia de la página anterior; la lista va por identificador descendente. El caso ajeno y
el inexistente responden 404. La pestaña «Evidencias» presenta el origen como declaración
y el tipo detectado por el sistema, también después de recargar la página. El detalle
ampliado de cada evidencia corresponde a HU-021.

HU-021 añade `GET /api/v1/cases/{case_id}/evidences/{evidence_id}`. Solo un miembro
vigente del caso puede consultar los metadatos; una evidencia inexistente, de otro caso o
de un caso ajeno produce el mismo 404. La respuesta no incluye el archivo cifrado, su
clave de almacenamiento ni el token del sello. Incluye la huella SHA-256, el origen
declarado, el tamaño exacto, el estado y la hora del sello, y los eventos vinculados a esa
evidencia. Los eventos se ordenan del más reciente al más antiguo en páginas de 50; para
continuar se envía `event_cursor` con el valor de `next_event_seq`. Los números de evento
son posiciones en la cadena del caso, por lo que pueden tener huecos en esta vista.
