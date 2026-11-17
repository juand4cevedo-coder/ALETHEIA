# Versión 0.4.7

16 de noviembre de 2026.

## Cambios

- Publica el vencimiento automático de pruebas y cortesías preparado para v0.4.6. El trabajador verifica el estado y la fecha bajo bloqueo antes de vencer una suscripción y registra la acción en auditoría.
- Permite a la cuenta propietaria conceder, renovar y revocar planes de cortesía con motivo y trazabilidad, sin registrar pagos inexistentes.
- Corrige la migración 0018 para agendar las pruebas preexistentes. El intento de publicación de v0.4.6 falló durante esa migración y se revirtió; la etiqueta v0.4.6 se conserva como registro del intento.

## Verificación de publicación

- CI con PostgreSQL: migración de una prueba preexistente desde 0017 a 0018, esquema completo, permisos, backend y frontend.
- Comprobar en producción que la migración termina, la salud de API y base responde, las suscripciones de prueba existentes tienen tarea de vencimiento y la consola de cortesías funciona para la cuenta propietaria.
- Comprobar que el acceso de usuarios ajenos a la plataforma sigue limitado y que no aparecen eventos de pago por una cortesía.

El sello externo RFC 3161, la exportación de paquetes y los cobros reales siguen pendientes. La etiqueta firmada `v0.4.7` sobre `main` inicia la publicación y el entorno `production` requiere aprobación manual.
