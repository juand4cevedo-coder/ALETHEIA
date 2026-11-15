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
carece de permisos de actualización o eliminación en la tabla (ADR-039).

`GET /api/v1/cases/{case_id}/custody-verification` recalcula con `hashlib` toda la cadena
guardada. La respuesta indica si está íntegra, cuántos eventos se comprobaron, el primer
número que no cierra, la causa (`sequence`, `previous_hash` o `event_hash`) y la huella
de la última posición válida. También compara el total leído con `cases.custody_seq` para
detectar la eliminación directa de la cola. Solo quien pertenece al caso obtiene el
informe; la respuesta y los errores llevan `Cache-Control: no-store`.

La interfaz muestra «Sin verificar» hasta que la persona pide el recálculo. Si detecta una
alteración, informa el primer número afectado. Si todo coincide, describe únicamente la
integridad de los registros guardados: el anclaje externo de la cadena sigue pendiente
(HU-025).
