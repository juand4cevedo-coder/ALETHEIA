# Aletheia 0.30.0

- **Pestaña Evidencias más útil.** Arriba, un resumen: cuántos archivos hay, cuánto espacio ocupan y cuántos tienen el sello de tiempo obtenido, pendiente o fallido. Cada archivo muestra ahora el estado de su sello y su huella SHA-256 (abreviada, con botón para copiarla). Con más de un archivo aparecen la búsqueda por nombre (sin distinguir mayúsculas ni acentos) y los filtros por estado del sello y por tipo, cada uno con su conteo. Los filtros actúan sobre lo ya cargado; si hay más archivos, «Ver más evidencias» los trae.
- No hay cambios de API, migraciones ni rutas nuevas.

Para verlo después de desplegar: abra un caso con varias evidencias y entre a Evidencias. Debe verse el resumen, el estado del sello en cada archivo y los filtros. Un archivo con sello fallido debe aparecer marcado y quedar filtrable en «Sello fallido».
