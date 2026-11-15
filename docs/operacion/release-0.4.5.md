# Versión 0.4.5

15 de noviembre de 2026.

## Cambio

- Los miembros asignados a un caso pueden pedir el recálculo de su cadena de custodia. El informe distingue una cadena íntegra de un evento alterado o una secuencia truncada e identifica el primer número afectado.
- El resultado visible describe la integridad de los registros guardados y aclara que todavía no existe anclaje externo. La consulta no expone casos ajenos ni guarda el informe en caché.

## Verificación

- CI con PostgreSQL: pruebas de integridad, alteración directa, permisos y contrato OpenAPI.
- Frontend: pruebas de los estados de la cadena, lint y build.
- Tras la aprobación del entorno `production`, comprobar salud, acceso a la consulta y presentación de los estados en un caso de prueba.

El sello externo RFC 3161 de evidencias y el anclaje externo de la cadena siguen pendientes (HU-020 y HU-025).

La etiqueta firmada `v0.4.5` sobre `main` inicia la publicación. El entorno `production` requiere aprobación manual.
