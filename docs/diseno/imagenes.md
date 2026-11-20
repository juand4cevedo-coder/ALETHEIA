# Imágenes del producto

| Campo | Contenido |
| --- | --- |
| Fecha | 20 de noviembre de 2026 |
| Alcance | Las fotografías del sitio público y de la pantalla de acceso, y los derivados de la marca |
| Especificación | `rediseno-2026-11-19.md`, secciones 7.5 y 7.6 |

## 1. Fotografías

Las cuatro provienen de Unsplash bajo su licencia gratuita, que permite el uso comercial sin pedir permiso ni pagar, y que no exige atribución aunque sí la recomienda. Esta tabla la registra de todos modos: cuesta nada y es lo correcto.

Se descartaron las imágenes de Unsplash+, que es el servicio de pago. Se distinguen por el dominio desde el que se sirven, `plus.unsplash.com` frente a `images.unsplash.com`, y no por su apariencia en los resultados de búsqueda, así que conviene revisarlo antes de usar una.

| Nombre base | Dónde se usa | Autor | Fotografía |
| --- | --- | --- | --- |
| `seguridad` | Sección de seguridad de la portada, a sangre sobre tinta | uve sanchez (@uvesanchez) | [Bloques de hormigón en blanco y negro](https://unsplash.com/photos/grayscale-photography-of-concrete-blocks-9DRX_cW48RQ) |
| `cierre` | Bloque de cierre de la portada, a sangre sobre tinta | amirreza momennia (@amirreza_momennia) | [Camino entre niebla](https://unsplash.com/photos/a-black-and-white-photo-of-a-foggy-road-5_3nATWCTTY) |
| `pie` | Pie de página, disuelto hacia el marfil | Elias Maurer (@elmaurer) | [Árboles cubiertos de nubes](https://unsplash.com/photos/grayscale-photo-of-trees-covered-by-clouds-QSwk-0XxDBk) |
| `acceso` | Columna izquierda de las pantallas de acceso | Joanna Kosinska (@joannakosinska) | [Papel y pluma](https://unsplash.com/photos/brown-paper-and-black-pen-B6yDtYs2IgY) |

Ninguna muestra abogados posando, martillos de juez ni balanzas. Esa iconografía es el indicio más rápido de plantilla comprada y la especificación la excluye de forma explícita.

**Los archivos se alojan con el producto.** Nunca se enlaza a Unsplash desde el sitio: eso ataría la portada a la disponibilidad de un tercero y le entregaría la dirección IP de cada visitante.

## 2. Encuadres y pesos

Cada fotografía se recorta en origen a la proporción que su sección usa de verdad. Recortar al generar, y no con `object-fit` en el navegador, evita descargar píxeles que nunca se van a ver.

| Nombre | Proporción | Calidad | 400 | 800 | 1200 | 1600 |
| --- | --- | --- | --- | --- | --- | --- |
| `seguridad` | 16:9 | 0,70 | 13 kB | 56 kB | 111 kB | 229 kB |
| `cierre` | 16:9 | 0,80 | 3 kB | 8 kB | 17 kB | 42 kB |
| `pie` | 2:1 | 0,80 | 2 kB | 6 kB | 10 kB | 18 kB |
| `acceso` | 4:5 | 0,80 | 14 kB | 37 kB | 64 kB | 94 kB |

`seguridad` lleva calidad más baja que las demás porque el hormigón tiene grano fino y ruido, que es justo lo que peor comprime. A 0,80 pesaba 528 kB en su ancho mayor; a 0,70 pesa 229 y la diferencia no se percibe bajo la capa de tinta que lleva encima. Un teléfono solo descarga los anchos de 400 u 800.

## 3. Cómo se generan los derivados

No hay herramienta de imagen en el proyecto y no se le agrega una: sería una dependencia permanente para un trabajo que se hace una vez por fotografía. Los derivados se generan fuera del proyecto y entran ya listos.

El procedimiento usado fue rasterizar en un navegador: descargar el original con CORS, recortarlo centrado al encuadre de la tabla, dibujarlo en un lienzo a cada ancho con `imageSmoothingQuality` en `high`, y exportarlo con `toBlob` en `image/webp` a la calidad indicada. Cualquier herramienta equivalente sirve mientras respete los encuadres, los anchos y los pesos de arriba.

**Solo WebP, sin AVIF.** La especificación lo explica en 7.5. El motivo práctico es que el navegador no codifica AVIF y, peor, no lo dice: al pedirle `image/avif` devuelve un PNG con el nombre cambiado. Se habrían publicado archivos `.avif` que eran PNG, más pesados que el original, sin que nada fallara.

## 4. Derivados de la marca

Las cuatro imágenes de mapa de bits de la marca salen de maestros vectoriales que viven en esta misma carpeta. Se rasterizan igual, dibujando el SVG en un lienzo.

| Maestro | Destino | Tamaño |
| --- | --- | --- |
| `favicon-32.svg` | `frontend/public/favicon.png` | 32 × 32 |
| `apple-touch-icon-180.svg` | `frontend/public/apple-touch-icon.png` | 180 × 180 |
| `og-image.svg` | `frontend/public/og-image.png` | 1200 × 630 |
| `logo-correo-128.svg` | `frontend/public/email/logo-claro.png` | 128 × 128 |

**La imagen social tiene una trampa.** Sus titulares van en Fraunces, pero un SVG dibujado dentro de una etiqueta de imagen se renderiza aislado y no hereda las tipografías de la página: saldría con la fuente de respaldo sin que nada avisara. Hay que incrustar la tipografía dentro del propio SVG, como una `@font-face` con la fuente en base64, antes de rasterizar.

La tipografía no necesita subconjunto propio: se usa la compilación por eje que publica Fontsource, explicado en la sección 7.2 de la especificación.
