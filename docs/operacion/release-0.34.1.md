# Aletheia 0.34.1

- **Crear la cuenta con correo y contraseña.** La pantalla «Cree su cuenta» solo ofrecía Google; quien no quería usarlo, o no tenía una cuenta de Google libre, no podía registrarse. Ahora esa pantalla enlaza a «Crear la cuenta con correo y contraseña» (`/registro/correo`), con el mismo flujo de siempre: nombre, correo, contraseña con su medidor, aceptación de los términos y un enlace de verificación al correo. Desde ahí también se puede volver a Google.
- Sin cambios en la API ni migración: el registro con correo (`POST /api/v1/auth/register`) ya existía y solo faltaba su pantalla.
- Ya corregido en producción, sin versión nueva: el secreto del cliente de Google estaba guardado mal (repetido varias veces) y Google lo rechazaba con `invalid_client`. Con el secreto correcto el registro con Google funciona.
