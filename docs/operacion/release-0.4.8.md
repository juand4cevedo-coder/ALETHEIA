# Versión 0.4.8

16 de noviembre de 2026.

## Cambio

- El propietario y el administrador pueden consultar los eventos de seguridad de su despacho: ingresos, intentos fallidos y cambios administrativos. La vista no incluye contenido de casos ni detalles internos del registro. El abogado no tiene acceso.
- La consulta pagina los eventos y limita la respuesta a la organización de la sesión, reforzada por Row-Level Security. La IP y el agente de usuario siguen la anonimización a los 90 días (RN-027).

## Verificación de publicación

- CI con PostgreSQL: permisos de propietario, administrador y abogado; aislamiento entre despachos; exclusión de eventos de casos; paginación y contrato OpenAPI.
- Frontend: navegación por rol, acceso directo denegado al abogado, 320 pruebas, lint, tipos y build.
- Tras el despliegue, comprobar salud de API y sitio. Con una cuenta de despacho autorizada, abrir Auditoría de seguridad y comprobar que aparecen los ingresos sin datos de casos. Comprobar que un abogado recibe 403 en la API.

El sello externo RFC 3161, la exportación de paquetes y los cobros reales siguen pendientes. La etiqueta firmada `v0.4.8` sobre `main` inicia la publicación y el entorno `production` requiere aprobación manual.
