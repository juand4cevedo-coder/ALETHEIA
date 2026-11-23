# Aletheia 0.19.3

- Se apaga la red de distribución. Con `CDN_URL` sin definir, la imagen web se construye como antes de la 0.19.1: el JavaScript, las fuentes, el CSS y las imágenes salen de `aletheia.sbs`. No hay cambios de código.
- Motivo: la medición de Lighthouse en móvil sobre la portada bajó de 98 (sin CDN) a 88-90 con el CDN (0.19.1) y a 78-85 con las precargas de conexión (0.19.2), con seis corridas en la misma dirección. Una prueba con `curl` desde Colombia mostró una ganancia real de 150 a 250 ms por archivo, que no compensa la baja del puntaje público ni la dependencia del sitio de un servicio más. El detalle está en `docs/operacion/produccion.md`, sección «Red de distribución».
- Se conserva todo lo construido: la distribución de CloudFront, el certificado, el registro DNS de `cdn.aletheia.sbs` y el código del interruptor. Para volver a encenderla basta crear la variable `CDN_URL` y publicar una versión nueva.

Esta versión no trae migraciones ni cambios en la API.

Para verlo después de desplegar: el código fuente de https://aletheia.sbs no debe mencionar `cdn.aletheia.sbs` y el JavaScript debe pedirse a `aletheia.sbs/assets/`. Corra Lighthouse en móvil: debe volver a unos 98.
