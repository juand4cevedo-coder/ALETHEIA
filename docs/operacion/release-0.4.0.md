# Preparación de la versión 0.4.0

13 de noviembre de 2026. Esta versión sustituye la v0.2.0 publicada. El intento de publicar
v0.3.0 quedó esperando aprobación y se canceló para evitar instalar una versión intermedia.

## Alcance

- Portada oscura con candado criptográfico, líneas de profundidad y recorrido verde continuo
  en el borde de las tarjetas. La preferencia de movimiento reducido conserva la escena fija.
- Registro, ingreso, recuperación, precios y documentación de la rama `develop`, ausentes o
  desactualizados en la versión publicada. Los precios se consultan en la API real.
- Administración inicial de cuentas de la plataforma, separada de los datos de los despachos.
  El cargo único se asigna después del despliegue a una cuenta activa con correo verificado.
- Imagen social, reglas de indexación y documentación acordes con la interfaz actual.

## Verificación y publicación

El PR #107 pasó las comprobaciones de backend, frontend, imágenes, dependencias y CodeQL.
El formulario de registro se abrió en el navegador local; el catálogo público respondió 200
en producción y el navegador mostró sus cuatro planes después de cargar. La suite de pruebas
del release debe pasar antes de etiquetar. La prueba de humo externa comprueba ahora el
catálogo además de la salud y las cabeceras.

La etiqueta firmada `v0.4.0` sobre `main` inicia la construcción por digest. El entorno
`production` conserva su revisión manual antes del despliegue. Tras publicar se comprueban
en el navegador la portada, `/precios`, `/registro`, `/ingresar` y el flujo de verificación de
correo con una cuenta autorizada. Los módulos de facturación, soporte y auditoría transversal
de la consola de plataforma siguen fuera de esta versión.
