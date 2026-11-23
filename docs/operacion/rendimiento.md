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

## Medición con Lighthouse (23 de noviembre de 2026, versión 0.18.0)

Lighthouse 12 sobre https://aletheia.sbs con Edge 158 en modo sin cabeza, con la simulación de red y de CPU móvil por omisión. Se instaló fuera del repositorio, solo para medir.

| Página | Dispositivo | Rendimiento | Accesibilidad | Prácticas | SEO | FCP | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Inicio | Móvil | 98 | 100 | 100 | 100 | 1,7 s | 2,2 s | 40 ms | 0 |
| Inicio | Escritorio | 80 | 100 | 100 | 100 | 1,6 s | 2,0 s | 70 ms | 0 |
| Precios | Móvil | 97 | 100 | 100 | 100 | 1,8 s | 2,2 s | 70 ms | 0 |
| Ingresar | Móvil | 95 | 100 | 100 | 69 | 1,8 s | 2,6 s | 30 ms | 0 |

Lo que dicen los números:

- **Accesibilidad, prácticas y desplazamiento de diseño están al máximo.** Accesibilidad 100 en todas las páginas medidas y CLS de 0.
- **El 69 de SEO en «Ingresar» es intencional:** la página lleva `noindex` para que los buscadores no la indexen, y Lighthouse lo marca como no rastreable.
- **El 80 de escritorio es la escala, no un problema nuevo.** Lighthouse mide escritorio con umbrales más estrictos (un LCP bueno es de 1,2 s) y aquí se aplicó la simulación móvil de red. En un equipo de escritorio con red normal el LCP es menor.
- **El elemento más grande que se pinta es el texto del aviso de cookies,** no la foto: para una visita nueva, el párrafo del aviso. Tarda en pintarse porque la página se dibuja en el navegador (React): primero llega el JavaScript. Son unos 1,3 s de «retraso de pintado» después de recibir el HTML. Bajarlo de verdad exige dibujar la portada en el servidor o prerenderizarla, que es un cambio de arquitectura.
- **El tiempo de respuesta del documento fue de 120 ms**, lo bueno de servir un HTML pequeño y comprimido.

### Lo que Lighthouse señaló y se corrigió

Las siete capturas del producto (1260 px de ancho) se servían completas a un teléfono que las dibuja a unos 340 px: 219 KB de ahorro posible. Ahora cada captura tiene una variante de 640 px, un 70 % más liviana, y las imágenes llevan `srcset` y `sizes` (carrusel, recorrido, menú de escritorio).

### Lo que quedó señalado y por qué no se tocó

- **28 KB de JavaScript sin usar en el archivo de entrada.** Es código del router, de las sesiones y de la caché de datos que la portada no ejecuta pero el resto del sitio sí. Separarlo es posible, pero el presupuesto de JavaScript inicial ya está en 119,6 KB de 120 y cualquier reorganización hay que medirla.
- **Cadena de recursos:** HTML, luego CSS, luego la fuente monoespaciada (23 KB). La fuente de interfaz ya se precarga; la monoespaciada no es crítica.
- **881 elementos en el DOM:** razonable para una página larga.

## Lo que no se midió bien

- **LCP y FCP con visitantes reales.** Lighthouse mide en un laboratorio con simulación. Para saber cómo lo vive un cliente de verdad hace falta registrar los Core Web Vitales en producción.
- **Contraste de color de todas las pantallas.** Las pruebas de axe del repositorio lo cubren por componente; no se revisó la página publicada completa.

## Recomendaciones que quedan

- **Una red de distribución de contenido** delante de `/assets` y `/media`. Hoy todo sale de una instancia en Ohio con un TTFB de unos 450 ms desde Colombia. Es el cambio de mayor efecto, pero implica infraestructura (CloudFront) y el plan gratuito de AWS limita regiones.
- **Pocas peticiones pequeñas.** La portada hace 79 peticiones, 48 de ellas de menos de 2 KB, porque cada ícono es su propio archivo (decisión de `vite.config.ts` para que cada pantalla descargue solo los íconos que dibuja). Con HTTP/2 cuesta poco, pero una agrupación de los íconos más usados bajaría el número sin subir mucho los bytes.
- **Medir en datos reales:** registrar los Core Web Vitales de visitantes reales (sin terceros, con una llamada propia) para decidir con números.
