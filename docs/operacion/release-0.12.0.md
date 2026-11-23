# Aletheia 0.12.0

- Plantillas de tareas del despacho: quien gestiona tareas (propietario, administrador y abogado) crea plantillas con hasta 30 tareas, cada una con prioridad y plazo en días, y las aplica a un caso abierto. Se crean todas las tareas con la misma persona responsable o ninguna, y cada plazo vence a las 5 de la tarde de Colombia.
- Pantalla «Plantillas de tareas» en el menú del espacio de trabajo y botón «Usar una plantilla» en las tareas del caso.
- Nuevos `GET`, `POST` y `DELETE /api/v1/task-templates` y `POST /api/v1/cases/{id}/tasks/from-template`. Cada tarea creada deja su evento `case_task_created` con el identificador de la plantilla.
- Cada despacho ve solo sus plantillas y el nombre no se repite dentro del despacho. Un asistente no las gestiona.

Esta versión incluye una migración (0037: tablas `task_templates` y `task_template_items`, con seguridad por filas). El despliegue la aplica antes de actualizar la API y no se revierte; la API anterior sigue funcionando con las tablas extra.

Una plantilla no se edita todavía: se borra y se crea de nuevo. Crear o borrar una plantilla no deja evento de auditoría propio.
