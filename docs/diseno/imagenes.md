# Imágenes del producto

| Campo             | Contenido                                                                            |
| ----------------- | ------------------------------------------------------------------------------------ |
| Fecha             | 25 de noviembre de 2026                                                              |
| Alcance           | Ilustraciones, capturas del producto, derivados de la marca y tipografías de los PDF |
| Sistema de diseño | [Identidad y sistema de diseño](identidad-y-sistema-de-diseno.md), ADR-060           |

## 1. Fotografías

Desde la versión 0.49.0 el sitio usa fotografía editorial de abogados latinos en su trabajo: reuniones con clientes, equipos revisando documentos, acuerdos y la ciudad. Le dan vida a cada sección y muestran a quién sirve el producto. Ninguna muestra martillos de juez ni balanzas: esa iconografía delata una plantilla comprada.

Todas vienen de Unsplash con su licencia gratuita, que permite el uso comercial sin pagar ni pedir permiso. Ninguna es de Unsplash+, el servicio de pago. La licencia no exige atribución; esta tabla la registra de todos modos. Casi todas son de la misma sesión de Vitaly Gariev, por eso comparten luz, color y vestuario.

| Archivo           | Autor              | Fuente                                                                     |
| ----------------- | ------------------ | -------------------------------------------------------------------------- |
| `equipo-portada`  | Vitaly Gariev      | [unsplash.com/photos/gItonyvrdUA](https://unsplash.com/photos/gItonyvrdUA) |
| `abogado-llamada` | Vitaly Gariev      | [unsplash.com/photos/NWT8Hya-_WQ](https://unsplash.com/photos/NWT8Hya-_WQ) |
| `cliente`         | Vitaly Gariev      | [unsplash.com/photos/Hl1HIQ0fmQk](https://unsplash.com/photos/Hl1HIQ0fmQk) |
| `equipo`          | Vitaly Gariev      | [unsplash.com/photos/8k5j5z6ZYT4](https://unsplash.com/photos/8k5j5z6ZYT4) |
| `acuerdo`         | Md Ishak Rahman    | [unsplash.com/photos/MkNnPlMThgk](https://unsplash.com/photos/MkNnPlMThgk) |
| `socio`           | Vitaly Gariev      | [unsplash.com/photos/VpCJ42lG7sk](https://unsplash.com/photos/VpCJ42lG7sk) |
| `despacho`        | Vitaly Gariev      | [unsplash.com/photos/yI6b7L1PDxs](https://unsplash.com/photos/yI6b7L1PDxs) |
| `firma`           | Vitaly Gariev      | [unsplash.com/photos/iPheGw7_UaI](https://unsplash.com/photos/iPheGw7_UaI) |
| `reunion`         | Vitaly Gariev      | [unsplash.com/photos/r-W9R70iY5c](https://unsplash.com/photos/r-W9R70iY5c) |
| `revision`        | Olena Kholina      | [unsplash.com/photos/MhqUBTxQ3Hw](https://unsplash.com/photos/MhqUBTxQ3Hw) |
| `expediente`      | TRAN NHU TUAN      | [unsplash.com/photos/Ydnhp9z0FOU](https://unsplash.com/photos/Ydnhp9z0FOU) |
| `ciudad`          | Jack’s Flight Club | [unsplash.com/photos/psQjHZRR46o](https://unsplash.com/photos/psQjHZRR46o) |

Se publican en `frontend/public/media/fotos/` como WebP a 640, 1280 y 1920 px. Las que van a pantalla completa suman 2560 px para pantallas retina grandes. `fotoProps` en `frontend/src/config/media.ts` arma el `srcset`. Se descargaron ya redimensionadas desde el servicio de imágenes de Unsplash; las dos de ciudad llevan menos calidad porque siempre van bajo una capa de tinta. Ninguna se pide a Unsplash desde el sitio: se alojan con el producto.

Las capturas de la aplicación, el emblema, el grabado y las láminas del blog siguen como antes.

## 2. Capturas del producto

Las siete capturas (`resumen`, `casos`, `actividad`, `evidencias`, `tareas`, `paquete` y
`verificador`) viven en `frontend/public/media/producto/`, en WebP y en tres anchos:

| Archivo            | Ancho   | Para quién                               |
| ------------------ | ------- | ---------------------------------------- |
| `nombre-640.webp`  | 640 px  | Teléfonos, que las dibujan a unos 340 px |
| `nombre.webp`      | 1260 px | Escritorio con densidad 1                |
| `nombre-2520.webp` | 2520 px | Pantallas retina                         |

`productShotProps` en `frontend/src/config/media.ts` arma el `srcset` y el navegador elige el
ancho. Se toman a 1260 × 720 con densidad 2, en modo claro, con las animaciones de entrada
apagadas para que ninguna sección salga vacía.

Cuando cambia la interfaz, las capturas se rehacen con la cuenta de prueba local. Nunca se toman
con datos de clientes reales.

## 3. Derivados de la marca

`frontend/scripts/marca.mjs` genera todos los archivos de `frontend/public/brand/`, los íconos
(`favicon.ico` de 16, 32 y 48 px, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png` e
`icon-512.png`) y el logo de los correos (`public/email/logo-claro.png`, 128 px). Todos salen de
la misma geometría que usa la aplicación, así que el símbolo es idéntico en todas partes.

`frontend/scripts/imagenes-sociales.mjs` genera las imágenes para compartir en redes
(1200 × 630). Sus textos se convierten a trazados antes de rasterizar, así el resultado no
depende de las fuentes instaladas en el equipo.

Los íconos de 16 y 32 px usan una variante reducida del símbolo para que el contorno y el iris
no se fundan. Cada rasterización se revisa a simple vista antes de publicarla. Tras cambiar el
favicon se sube la versión de los enlaces en `index.html` (`?v=4`) para que los navegadores lo
vuelvan a pedir.

## 4. Tipografías de los PDF

El comprobante de pago se dibuja con reportlab, que solo incrusta TrueType estático. El sitio
publica Geist, Newsreader y Geist Mono como WOFF2 variables, así que
`backend/scripts/fuentes_pdf.py` toma esos mismos archivos de `frontend/node_modules`, fija el
peso y el tamaño óptico de cada estilo y guarda los TTF en `backend/app/assets/fonts/`, junto a
sus licencias OFL. Se corre solo cuando cambia la versión de las fuentes.

## 5. Formato

**Solo WebP, sin AVIF.** El navegador no codifica AVIF y no lo avisa: al pedirle `image/avif`
devuelve un PNG con el nombre cambiado. Se habrían publicado archivos `.avif` que eran PNG, más
pesados que el original, sin que nada fallara.

**Todo se aloja con el producto.** Ninguna imagen se pide a un tercero: eso ataría el sitio a la
disponibilidad de otro servicio y le entregaría la dirección IP de cada visitante. Caddy sirve
`/media/*` con una semana de caché, y la prueba de humo del despliegue lo comprueba con una
captura del producto.
