# Versión 0.4.12

19 de noviembre de 2026.

## Cambios

- La auditoría de plataforma mostraba el UUID crudo de la persona y del despacho en cada evento, ilegible en cualquier tamaño de pantalla. Ahora resuelve esos nombres con una sola consulta por página.
- Cuentas, Auditoría y Facturación de la consola de plataforma dejan de ser tablas planas sin jerarquía: las cifras de facturación y el estado de cada cuenta usan los mismos componentes (`StatTile`, `StatusBadge`) que el resto de la aplicación.

## Verificación de publicación

- CI con PostgreSQL, frontend, imágenes y CodeQL sobre la rama de versión.
- Tras aprobar el entorno `production`: con la cuenta del propietario de la plataforma, abrir la auditoría y confirmar que muestra nombres en vez de identificadores, y revisar que Cuentas y Facturación se vean con jerarquía clara.

La etiqueta firmada `v0.4.12` sobre `main` inicia la publicación. El entorno `production` requiere aprobación manual.
