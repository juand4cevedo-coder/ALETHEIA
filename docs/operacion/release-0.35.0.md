# Aletheia 0.35.0

- **Banco de datos.** Nueva sección en el menú, «Banco de datos» (`/app/banco-de-datos`): el archivo de los casos cerrados donde la persona es miembro, con sus cifras (casos archivados, evidencias conservadas, tamaño conservado, plazos vencidos y bloqueos por litigio), una búsqueda y un índice descargable. Es una vista de lectura: no da acceso a ningún caso nuevo, y el contenido de cada caso (evidencias, cadena de custodia, paquete de preservación) se abre desde el propio caso, como antes.
- **Búsqueda más completa.** La búsqueda del archivo, y también la del libro de casos, encuentra un caso por el nombre de uno de sus archivos o por el comienzo de su huella SHA-256 (de 8 a 64 caracteres hexadecimales), además de por título, radicado, referencia interna y despacho. Funciona con tildes y mayúsculas.
- **Filtros del archivo.** Año de cierre, especialidad, base de conservación y plazo de conservación (vencido o vigente). Las cifras de arriba y el índice descargable siguen siempre el mismo filtro que la lista.
- **Descargar el índice (CSV).** El índice del archivo se descarga como hoja de cálculo que Excel abre con las tildes bien: título, radicado, despacho, especialidad, referencia interna, fecha de cierre, base y plazo de conservación, bloqueo por litigio, evidencias y miembros. Las celdas que empiezan como una fórmula se neutralizan, y el índice trae como máximo 5.000 casos: con más, conviene filtrar por año o especialidad.
- Rutas nuevas: `GET /api/v1/archive/summary` y `GET /api/v1/archive/export`; `GET /api/v1/cases` acepta `practice_area` con `status=closed`. Sin migración.

**Límites conocidos**
- Cada persona ve el archivo de los casos en los que es miembro. El responsable y el administrador no ven los casos de otros miembros sin ser miembros del caso: es la regla de siempre.
- Las pruebas de base de datos de este cambio las ejecuta la CI.
