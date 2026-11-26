# Imágenes del producto

| Campo             | Contenido                                                                            |
| ----------------- | ------------------------------------------------------------------------------------ |
| Fecha             | 25 de noviembre de 2026                                                              |
| Alcance           | Ilustraciones, capturas del producto, derivados de la marca y tipografías de los PDF |
| Sistema de diseño | [Identidad y sistema de diseño](identidad-y-sistema-de-diseno.md), ADR-060           |

## 1. Sin fotografías de banco

Desde la versión 0.48.0 el sitio no usa fotografías de banco. Las fotos de oficinas y personas
posando decían poco del producto y se parecían a las de cualquier otro software. Cada imagen
del sitio sale ahora de una de tres fuentes:

- **El producto mismo.** Capturas reales de la aplicación con la cuenta de prueba local y un caso
  de ejemplo.
- **La geometría de la marca.** El emblema, el grabado de guilloché y las láminas ilustradas se
  dibujan en SVG a partir de `frontend/src/brand/geometria.ts`.
- **Las láminas del blog y del paso a paso.** Ilustraciones en SVG del componente `Lamina`, con
  un motivo por tema: chat, cadena, procesos, sellos, huella, acceso y expediente.

Ninguna imagen muestra abogados posando, martillos de juez ni balanzas. Esa iconografía delata
una plantilla comprada.

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
