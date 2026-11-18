# Versión 0.4.11

18 de noviembre de 2026.

## Cambios

- El despacho del propietario de la plataforma (el dueño de ALETHEIA) ya no se trata como el de un cliente: ya no ve la tarjeta de pago con Nequi en Mi cuenta, y su suscripción nunca vence ni pasa a solo lectura por falta de pago.

## Verificación de publicación

- CI con PostgreSQL, frontend, imágenes y CodeQL sobre la rama de versión.
- Tras aprobar el entorno `production`: con la cuenta del propietario de la plataforma, abrir Mi cuenta y confirmar que ya no aparece la tarjeta de pago con Nequi.

La etiqueta firmada `v0.4.11` sobre `main` inicia la publicación. El entorno `production` requiere aprobación manual.
