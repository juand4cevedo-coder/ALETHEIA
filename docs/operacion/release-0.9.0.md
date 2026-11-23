# Aletheia 0.9.0

- Vigilancia de la plataforma: el servidor publica cada minuto métricas de salud en CloudWatch (peticiones, errores 5xx, latencia, memoria, disco, contenedores), con alarmas que avisan antes de la falla y durante ella, una sonda externa de Route 53 y un panel. Guía de instalación en `docs/operacion/observabilidad.md`. No cambia la aplicación.
- Purga de casos con tareas: un caso con tareas ya se puede eliminar al vencer su conservación. Antes la purga fallaba porque borraba a los miembros antes que las tareas.
- Título de las pestañas con la marca primero, y recarga del favicon.

Esta versión incluye una migración (0035, redefine la función `purge_case`). El despliegue la aplica antes de actualizar la API y no se revierte; la API anterior sigue funcionando.

La vigilancia no se activa sola: después de desplegar hay que ejecutar `infra/aws/observabilidad.sh` en CloudShell y activar el temporizador en el servidor.
