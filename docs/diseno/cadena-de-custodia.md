# Consulta de la cadena de custodia (HU-023)

`GET /api/v1/cases/{case_id}/custody-events` devuelve los eventos de un caso asignado,
del más reciente al más antiguo. Cada elemento trae el número de secuencia, la acción,
el nombre de quien la realizó (o `null` si fue el sistema), la fecha y la huella SHA-256
del evento. El caso ajeno o inexistente responde 404 sin revelar su existencia.

La primera página trae 20 eventos. `limit` acepta de 1 a 50 y `cursor` es el número de
secuencia devuelto como `next_cursor`; la siguiente consulta lee solo secuencias menores.
La interfaz carga las páginas anteriores bajo demanda y muestra la cadena en orden
cronológico. La respuesta lleva `Cache-Control: no-store`.

No existen operaciones de edición ni borrado para estos eventos. El rol de la aplicación
carece de permisos de actualización o eliminación en la tabla (ADR-039). La pantalla
indica «Sin verificar» hasta que HU-024 compruebe la cadena completa de forma independiente.
