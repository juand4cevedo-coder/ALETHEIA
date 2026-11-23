# Aletheia 0.15.0

- Política del despacho para exigir el segundo factor a todo el equipo, solo del propietario, en Organización > Políticas del despacho. Está apagada por omisión: ningún despacho cambia de comportamiento al desplegar.
- Con la política activa, quien no tenga el segundo factor puede ingresar, pero la API le responde 403 con el tipo `https://aletheia.sbs/problemas/activar-segundo-factor` a todo lo que no sea ver su perfil, activar el segundo factor o cerrar sesión. Eso incluye la descarga y la exportación de evidencia. La interfaz reemplaza el espacio de trabajo por la pantalla «Active la verificación en dos pasos» y deja entrar al confirmar que se guardaron los códigos de respaldo.
- El propietario debe tener el segundo factor activo antes de exigirlo (si no, 409 con la explicación) y mientras esté exigido nadie puede desactivarlo.
- `GET /api/v1/me` incluye `two_factor_setup_required`; `GET` y `PUT /api/v1/organization/policies` incluyen `require_two_factor`. Cada cambio de la política queda en la auditoría del despacho.
- Cada petición autenticada hace una lectura más: la política de la organización. Es una consulta por llave primaria.

Esta versión incluye una migración (0040: columna `organizations.require_two_factor`, falsa por omisión). El despliegue la aplica antes de actualizar la API y no se revierte; la API anterior sigue funcionando porque la columna tiene valor por omisión.

Para probarlo después de desplegar, use una cuenta de abogado de prueba y no la suya: active la política con una cuenta propietaria que ya tenga el segundo factor, ingrese como el abogado en una ventana de incógnito y compruebe que solo puede activar el segundo factor. Si algo falla, apague la política desde la sesión del propietario. Una persona que pierda el teléfono y los códigos de respaldo sigue necesitando a soporte.
