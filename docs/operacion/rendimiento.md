# Revisión de rendimiento y accesibilidad

Fecha: 23 de noviembre de 2026, sobre la versión 0.16.0 desplegada en https://aletheia.sbs. Las medidas de red salen de `curl` desde un equipo en Colombia y las del navegador, de la API de rendimiento de Chrome en una vista de 375 px. No se usó Lighthouse: instalarlo pide una dependencia nueva.

## Lo que ya estaba bien

- **Compresión y protocolo:** Caddy comprime con zstd y gzip y sirve HTTP/2. El script principal pasa de 253 KB a 83 KB con gzip.
- **Caché:** los archivos con huella (`/assets/*`) llevan `max-age=31536000, immutable`; el HTML se revalida siempre; las imágenes (`/media/*`) se guardan una semana con revalidación en segundo plano.
- **Peso de la portada:** 204 KB transferidos (148 KB de JavaScript, 40 KB de la foto, 10 KB de CSS). Desplazamiento de diseño acumulado (CLS) de 0,000.
- **Cabeceras de seguridad:** CSP sin `unsafe-inline`, HSTS de un año, COOP y CORP del mismo origen.
- **Accesibilidad:** una sola `h1`, jerarquía de encabezados ordenada, `lang="es"`, un `main`, ninguna imagen sin `alt`, ningún botón o enlace sin nombre accesible, ningún `tabindex` positivo y los textos legales con descripción y URL canónica.

## Lo que se corrigió en esta revisión

1. **La foto de la portada empezaba a bajar a los 1158 ms**, después de ejecutar el JavaScript (React la dibuja). Ahora el HTML la precarga con `fetchpriority="high"` y los mismos anchos que usa la imagen, así que el navegador la pide desde que lee el HTML y reutiliza la descarga. Es el elemento más grande de la pantalla, así que adelanta el contenido más grande visible (LCP). El costo: las demás rutas de una primera visita también descargan esa foto, 40 KB que luego quedan en caché.
2. **Los puntos del carrusel medían 12 × 4 px** como objeto táctil. Ahora el botón mide 88 × 24 px (el mínimo de WCAG 2.2, criterio 2.5.8) y la barra que se ve sigue siendo de 4 px.
3. **Enlaces sueltos de 18 a 22 px de alto** en el pie y en «Comparar los planes»: ahora miden al menos 28 px y 44 px en pantallas táctiles.

## Lo que no se midió bien

- **LCP y FCP reales.** El panel del navegador desde el que se midió estaba oculto, y un navegador oculto retrasa el primer pintado, así que los 5 s que marcó no valen. Conviene repetir la medida con la pestaña a la vista, o con Lighthouse en una máquina con Node y Chrome.
- **Contraste de color de todas las pantallas.** Las pruebas de axe del repositorio lo cubren por componente; no se revisó la página publicada completa.

## Recomendaciones que quedan

- **Una red de distribución de contenido** delante de `/assets` y `/media`. Hoy todo sale de una instancia en Ohio con un TTFB de unos 450 ms desde Colombia. Es el cambio de mayor efecto, pero implica infraestructura (CloudFront) y el plan gratuito de AWS limita regiones.
- **Pocas peticiones pequeñas.** La portada hace 79 peticiones, 48 de ellas de menos de 2 KB, porque cada ícono es su propio archivo (decisión de `vite.config.ts` para que cada pantalla descargue solo los íconos que dibuja). Con HTTP/2 cuesta poco, pero una agrupación de los íconos más usados bajaría el número sin subir mucho los bytes.
- **Medir en datos reales:** registrar los Core Web Vitales de visitantes reales (sin terceros, con una llamada propia) para decidir con números.
