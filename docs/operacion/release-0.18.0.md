# Aletheia 0.18.0

- Código QR en la activación del segundo factor: al activar la verificación en dos pasos, Mi cuenta muestra un QR del enlace `otpauth://` que se escanea con la aplicación de autenticación. La clave escrita y el enlace para tocar desde el teléfono siguen ahí, para quien no pueda escanear.
- El QR se dibuja en el navegador, con el mismo enlace que ya se mostraba: el secreto no sale de la pantalla ni pasa por ningún servicio externo. Se entrega como imagen `data:`, que el CSP ya permite.
- Dependencia nueva: `qrcode-generator` 1.4.4 (MIT, sin dependencias propias, versión exacta, hash de integridad en `pnpm-lock.yaml` y dentro de la espera de 7 días del ADR-019). Se descarga en un archivo aparte, solo al activar el segundo factor. Anotada en `docs/adr/adr-050.md`.
- Presupuesto de JavaScript inicial: 119,56 KB de 120, por un archivo auxiliar de 0,3 KB que genera la biblioteca. Queda poco margen: lo nuevo del frontend inicial debe cargarse aparte.

Esta versión no trae migraciones ni cambios en la API ni en el servidor.

Para verlo después de desplegar: entre a Mi cuenta con `Ctrl F5`, pulse «Activar la verificación en dos pasos» y escanee el código con la aplicación del teléfono. La aplicación debe agregar una cuenta «ALETHEIA» con su correo. Compruebe que el código de 6 dígitos que muestra confirma la activación; si ya tiene el segundo factor activo, la tarjeta no muestra el QR (solo se ve al activarlo). Si el QR no se escanea, avíseme: la clave escrita sigue disponible.
