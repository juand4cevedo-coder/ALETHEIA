# Versión 0.4.4

15 de noviembre de 2026.

## Cambios

- Los abogados pueden asignar miembros de su despacho a un caso; solo las personas asignadas consultan sus datos.
- Los miembros autorizados pueden subir originales cifrados con origen declarado, huella SHA-256 y evento de custodia. El detalle muestra los metadatos y los eventos; los abogados pueden descargar el original verificado y esa descarga también queda registrada.
- El caso muestra su cadena de custodia completa, con páginas de eventos que incluyen acción, persona, fecha y huella.

## Alcance pendiente

- La autoridad externa para sellos RFC 3161 (DEP-04) aún no está confirmada. Las evidencias nuevas muestran `tsa_status: pending` y la aplicación no afirma que tengan un sello externo.
- La verificación independiente de la cadena y el paquete de preservación siguen pendientes (HU-024 y HU-025). La pantalla muestra «Sin verificar».

## Verificación de publicación

- Ejecutar CI de backend con PostgreSQL, frontend, imágenes y CodeQL sobre la rama de versión.
- Tras aprobar el entorno `production`, comprobar salud del sitio, acceso a casos por miembro, subida y descarga de un archivo de prueba y registro de sus eventos.
- Confirmar que los usuarios ven con claridad el estado pendiente del sello y de la verificación de la cadena.

La etiqueta firmada `v0.4.4` sobre `main` inicia la publicación. El entorno `production` requiere aprobación manual.
