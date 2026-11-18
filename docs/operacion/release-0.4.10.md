# Versión 0.4.10

18 de noviembre de 2026.

## Cambios

- Coherencia del espacio de trabajo interno: Miembros, Mi cuenta y Evidencia dejan de reinventar la tarjeta cada una a su manera y usan el componente `Panel` compartido; Soporte ya no pide prestado el CSS de otra pantalla.
- El símbolo de marca (encabezado, ingreso, página de marca) es ahora el mismo sello del favicon, en vez de convivir con un símbolo anterior distinto.
- Nuevo panel de Organización: el propietario puede ver y cambiar el nombre de su despacho, con su propio permiso (`organization.manage`) y su evento de auditoría.
- Los accesos rápidos de Inicio quedan visibles para todos los roles, no solo para quien administra el equipo.
- Una animación de entrada consistente en los paneles del espacio de trabajo y en las pantallas de ingreso y registro.

## Verificación de publicación

- CI con PostgreSQL, frontend, imágenes y CodeQL sobre la rama de versión.
- Tras aprobar el entorno `production`: comprobar la salud de la API y del sitio, abrir el panel de Organización con una cuenta propietaria y cambiar el nombre del despacho, y revisar que Miembros, Mi cuenta, Soporte y Evidencia se vean coherentes entre sí.

La etiqueta firmada `v0.4.10` sobre `main` inicia la publicación. El entorno `production` requiere aprobación manual.
