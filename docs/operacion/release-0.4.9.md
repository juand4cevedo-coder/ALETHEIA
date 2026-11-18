# Versión 0.4.9

18 de noviembre de 2026.

## Cambios

- Paquete de preservación completo (HU-025): el abogado solicita el paquete de un caso desde la pestaña Paquete, el trabajador arma el ZIP con los originales, el manifiesto firmado (ADR-044), la cadena de custodia y un informe en PDF, y lo deja listo para descargar con un enlace firmado por la aplicación que vence y se borra a las 24 horas.
- Verificador local (HU-026): la pantalla pública `/verificador` compara un archivo contra el `manifest.json` del paquete calculando la huella SHA-256 en el navegador, sin crear cuenta ni enviar el contenido.
- Sello de tiempo por evidencia (HU-020): cada evidencia que se sube pide su sello RFC 3161 a DigiCert, con Sectigo como respaldo, y el resultado queda en la cadena de custodia y dentro del paquete de preservación.
- Primer cobro de una suscripción con Wompi por Nequi (HU-027): el propietario del despacho puede iniciar el cobro desde Mi cuenta; la API crea la transacción y activa el plan cuando el webhook de Wompi confirma el pago.
- Seguridad y estabilidad: el bucket de evidencia ya no queda fijo en el código, la red interna de producción queda restringida a su subred, PostgreSQL corre con más restricciones, se agregan límites de subida y exportación por cuenta, y se corrige una condición de carrera al construir dos paquetes del mismo caso a la vez.
- Rediseño del frontend: favicon nuevo, un panel de inicio real con los casos y la actividad reciente de la organización, limpieza de paneles duplicados o vacíos, conversión de colores sueltos a los tokens del sistema de diseño, nueva pieza visual del inicio y revisión de accesibilidad y de redacción en toda la aplicación.

## Alcance pendiente

- El cobro con Wompi todavía no tiene cuenta de producción: las llaves se leen de variables de entorno y el propietario aún no cuenta con credenciales reales, así que el botón de pago no completa una transacción real hasta configurarlas.
- No existe todavía un trabajo de reconciliación para el cobro: si el webhook de Wompi nunca llega, la transacción queda pendiente sin que nada la reintente.
- El sellado diario de la cabeza de la cadena de custodia (ADR-037) sigue sin un disparador recurrente.

## Verificación de publicación

- CI con PostgreSQL, frontend, imágenes y CodeQL sobre la rama de versión.
- Tras aprobar el entorno `production`: comprobar la salud de la API y del sitio, solicitar y descargar el paquete de preservación de un caso de prueba, verificar ese paquete en `/verificador`, confirmar que una evidencia nueva queda con su sello de tiempo y revisar el panel de inicio con una cuenta de despacho autorizada.

La etiqueta firmada `v0.4.9` sobre `main` inicia la publicación. El entorno `production` requiere aprobación manual.
