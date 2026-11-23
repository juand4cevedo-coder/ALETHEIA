# Aletheia 0.11.0

- Políticas del despacho, en la pantalla Organización y solo para el propietario: cuántos años se conserva un caso archivado antes de su revisión (de 1 a 30, por omisión 10) y cuántos días dura una sesión (de 1 a 14, por omisión 14). Nuevos `GET` y `PUT /api/v1/organization/policies`; el `GET` lo consulta cualquier gestor.
- La conservación se calcula en la base de datos: `transition_case_lifecycle` lee el plazo de la organización. Un caso ya archivado conserva el plazo con el que se archivó.
- La duración de sesión solo puede acortar el plazo de 14 días, nunca alargarlo, y solo cuenta para los ingresos nuevos.
- Cada cambio de políticas queda como evento de seguridad (`organization_policy_changed`) en la auditoría del despacho, con la etiqueta «Políticas del despacho cambiadas».

Esta versión incluye una migración (0036: dos columnas en `organizations`, la función `transition_case_lifecycle` y la lista de acciones de auditoría). El despliegue la aplica antes de actualizar la API y no se revierte; la API anterior sigue funcionando porque las columnas tienen valor por omisión. Los valores por omisión son los de hasta ahora, así que ningún despacho cambia de comportamiento.

Queda fuera el segundo factor obligatorio: la plataforma todavía no tiene segundo factor.
