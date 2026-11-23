# Aletheia 0.13.0

- Verificación en dos pasos con una aplicación de autenticación (TOTP, RFC 6238) y diez códigos de respaldo de un solo uso. Se activa en Mi cuenta: la pantalla entrega una clave y un enlace `otpauth://` para la aplicación del teléfono, y se confirma con un primer código.
- Ingreso en dos pasos: con contraseña o con Google, una cuenta con el segundo factor no abre sesión hasta que llegue un código válido (de la aplicación o de respaldo). El ingreso entrega primero un desafío de 5 minutos en una cookie `__Host-aletheia_2fa`. `POST /api/v1/auth/login` puede responder 202; el segundo paso es `POST /api/v1/auth/login/two-factor`.
- Cuenta: `GET /api/v1/account/two-factor` y `POST` en `/setup`, `/enable`, `/disable` y `/recovery-codes`. Desactivar y renovar los códigos piden un código vigente.
- Seguridad: el secreto se guarda cifrado con AES-GCM y los códigos de respaldo solo como HMAC con una clave del servidor. Un código TOTP no se reutiliza. Cinco códigos errados por persona y veinte por IP cada 15 minutos agotan el límite. El soporte de plataforma no lee estas tablas.
- Auditoría: el despacho ve cuando alguien activa o desactiva el segundo factor, usa un código de respaldo, renueva los códigos o falla un código.
- Decisión y riesgos: `docs/adr/adr-050.md`.

Esta versión incluye una migración (0038: `user_two_factor`, `two_factor_recovery_codes` y la lista de acciones de auditoría). El despliegue la aplica antes de actualizar la API y no se revierte; la API anterior sigue funcionando con las tablas extra.

Después de desplegar: active el segundo factor en una cuenta de prueba e ingrese desde una ventana de incógnito antes de cerrar la sesión que ya tiene abierta. Queda fuera el código QR (pide una dependencia nueva) y exigir el segundo factor a todo el equipo.
