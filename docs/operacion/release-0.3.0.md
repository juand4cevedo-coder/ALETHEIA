# Preparación de la versión 0.3.0

13 de noviembre de 2026. Esta versión lleva a producción el trabajo integrado en `develop` desde `v0.2.0`, incluida la identidad pública vigente desde esa fecha.

## Alcance

- Portada y acceso con identidad renovada; escena criptográfica continua en SVG y CSS y borde animado en el recorrido. La preferencia de movimiento reducido deja la composición fija.
- Navegación, documentación, blog, páginas informativas, espacios de trabajo y correos alineados con la identidad actual.
- Recursos anteriores sin uso retirados y Three.js eliminado. `robots.txt`, mapa del sitio, metadatos y presupuesto de carga actualizados.
- Protección de la base de pruebas: la suite rechaza cualquier URL que no apunte a `aletheia_test` local. `opentelemetry-api` se resolvió en la versión 1.45.2.

## Comprobaciones antes de etiquetar

- El PR #103 pasó CI con PostgreSQL, frontend, auditoría de dependencias, imágenes Docker y CodeQL.
- La portada se revisó a 1260 y 390 px. La medición local dio 115,54 kB de JavaScript y 6,88 kB de CSS iniciales comprimidos. La revisión visual se hizo con movimiento reducido; falta observar el ciclo en un navegador con movimiento normal.
- En AWS, la instancia `aletheia-prod` estaba en línea por SSM. La orden `f86925b9-88a5-4cfd-bf7c-ecd906879019` comprobó cifrado y descifrado KMS con el rol de la instancia. SES tenía acceso de producción y envío habilitado.

## Publicación y retorno

El release se integra en `main` y se etiqueta `v0.3.0` con firma. El workflow `Publicar` verifica la etiqueta, construye imágenes por digest y espera la aprobación del entorno `production`. Tras desplegar, ejecuta la prueba de humo. El script revierte las imágenes si falla la salud; las migraciones no se revierten, por lo que deben seguir siendo compatibles con la versión anterior.

La versión pública anterior permanece disponible hasta completar ese flujo. Después del despliegue se comprueban la portada, el acceso, `robots.txt`, `sitemap.xml`, la API de salud, el envío transaccional y los indicadores reales de carga móvil.
