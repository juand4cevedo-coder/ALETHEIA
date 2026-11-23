# Aletheia 0.17.0

- Editar plantillas de tareas: cada plantilla tiene un botón «Editar» que abre su formulario con las tareas que ya tiene. Se cambia el nombre y se agregan, quitan o modifican tareas, y el reemplazo se guarda en una sola transacción. Las tareas ya creadas con la plantilla no cambian: son tareas normales del caso. Nuevo `PUT /api/v1/task-templates/{id}`; el nombre puede repetirse solo con el de la propia plantilla.
- Auditoría de las plantillas: crear, editar y borrar una plantilla dejan un evento en la auditoría del despacho («Plantilla de tareas creada», «editada» y «borrada»), con el nombre y la cantidad de tareas, y el nombre anterior cuando se renombra. Lo ven el propietario y el administrador.
- Permisos: solo quien gestiona tareas edita (propietario, administrador y abogado); un asistente recibe 403 y una plantilla de otro despacho responde 404.

Esta versión incluye una migración (0041: permiso de UPDATE solo sobre el nombre de `task_templates` para la aplicación, y tres acciones nuevas en la lista cerrada de la auditoría). El despliegue la aplica antes de actualizar la API y no se revierte; la API anterior sigue funcionando.

Para verlo después de desplegar: entre a Plantillas de tareas con `Ctrl F5`, pulse «Editar» en una plantilla, cambie una tarea y guarde. Luego revise Auditoría de seguridad: debe aparecer «Plantilla de tareas editada».
