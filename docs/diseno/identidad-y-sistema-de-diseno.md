# Identidad y sistema de diseño

| Campo | Contenido |
| --- | --- |
| Estado | Vigente desde la versión 0.50.0, 26 de noviembre de 2026 |
| Decisión | [ADR-060](../adr/adr-060.md), que reemplaza a [ADR-049](../adr/adr-049.md) |
| Imágenes | [Imágenes del producto](imagenes.md) |

## Color

Los valores viven en `frontend/src/styles/tokens.css`, la única fuente de la paleta. El sitio público, el acceso y el espacio de trabajo la heredan. Una prueba (`tokens.test.ts`) falla si un `var(--nombre)` no tiene definición, si un valor cambia sin pasar por el ADR o si un par de texto y fondo baja de 4,5:1.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--paper` | `#F6F1FB` | `#121016` | Lienzo: una lavanda suave, nunca blanco plano |
| `--paper-raised` | `#FFFFFF` | `#1A1720` | Tarjetas, paneles y campos, que se levantan sobre la lavanda |
| `--paper-sunken` | `#EFE7F8` | `#0D0B10` | Superficies hundidas y secundarias |
| `--paper-warm` | `#FBF5EA` | `#16121C` | Crema de las bandas que alternan con la lavanda |
| `--ink-900` | `#55278A` | `#7A52B8` | Violeta tinta: marca y acción principal |
| `--ink-700` | `#3F1C69` | `#6A44A6` | Violeta profundo para contraste y estados activos |
| `--seal`, `--seal-line` | `#7A5A22`, `#D9C69C` | `#D4B06A`, `#5C4A27` | Latón: solo donde hay sello, custodia o un detalle de marca |
| `--text`, `--text-2`, `--text-3` | `#16131C`, `#4A4553`, `#6B6575` | tonos claros equivalentes | Texto, AA o mejor sobre las tres superficies |
| `--ok`, `--warn`, `--err` | `#1F6B4A`, `#8A5A18`, `#9B2226` | `#74D3A3`, `#E8BB6F`, `#FF9499` | Estados, siempre acompañados de texto |

La psicología del color es deliberada: el violeta tinta es la firma (autoridad y criterio), la lavanda y la crema son sus versiones más claras y dan calma sin el frío del blanco, y el latón, el color del sello, marca lo que quedó guardado. Entre una banda y otra el color pasa con un degradado, sin cortes.

## Tipografía

| Familia | Uso |
| --- | --- |
| Newsreader | Títulos del sitio, títulos de cada pantalla y panel del espacio de trabajo, cifras y el comprobante en PDF |
| Geist | Interfaz, texto corrido, formularios y navegación |
| Geist Mono | Radicados, números de comprobante y valores técnicos |

En el espacio de trabajo, una regla de especificidad cero (`.main :where(h1, h2)` en `AppShell.module.css`) pone en Newsreader cada título, así ninguna pantalla queda con otra voz.

## Marca

El logo es el emblema aprobado: un ojo con la pupila de latón dentro de un anillo de 64 marcas, por los 64 caracteres de una huella SHA-256, con una banda de guilloché. Toda la geometría sale de `frontend/src/brand/geometria.ts`, y `frontend/scripts/marca.mjs` genera los archivos.

| Versión | Dónde va | Archivo |
| --- | --- | --- |
| Emblema completo | Portada del ingreso, imágenes para compartir | `public/brand/emblema.svg`, `emblema-oscuro.svg` |
| Emblema reducido (anillo, 32 marcas, guilloché, ojo y pupila) | Menú, íconos instalables, logo de los correos y comprobante en PDF | `public/brand/symbol-dark.svg`, `symbol-dark-mode.svg`, `symbol-white.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `public/email/logo-claro.png` |
| Emblema mínimo (círculo, aro de latón y ojo) | Pestaña del navegador a 16 y 32 px | `public/favicon.svg`, `favicon.png`, `favicon.ico` |
| Logotipo | Junto al emblema en el menú y el pie; en celulares angostos queda el emblema solo | componente `Logotipo` |

Los enlaces a íconos, al manifiesto y a la marca llevan `?v=5`; las capturas del producto, `?v=6`. Al cambiar un archivo con el mismo nombre se sube ese número, porque el navegador guarda `/brand` y `/media` una semana.

## Imágenes

Fotografía editorial de abogados en su trabajo (reuniones con clientes, equipos, acuerdos y la ciudad) y capturas reales del producto. El detalle de cada foto, su autor y su licencia está en [Imágenes del producto](imagenes.md).

## Movimiento

| Elemento | Comportamiento |
| --- | --- |
| Portada | El texto entra escalonado y la foto se acerca despacio al cargar. |
| Secciones | Aparecen al entrar en pantalla (`Reveal`); las cifras cuentan de cero a su valor solo con CSS. |
| Cinta de áreas del derecho | Se desplaza sola y se pausa al pasar el puntero (WCAG 2.2.2). |
| Recorrido del producto | La captura y su texto aparecen con un fundido al cambiar de pestaña. |
| Tarjetas y fotos | Se elevan y la foto se acerca al pasar el puntero. |
| Movimiento reducido | Con `prefers-reduced-motion` todo queda quieto; la cinta muestra sus áreas completas en una línea. |

Todo el movimiento de la portada es CSS: no suma JavaScript a la carga inicial.

## Componentes

| Elemento | Aplicación |
| --- | --- |
| Menú del sitio | Píldora de vidrio que flota separada del borde, gana fondo y sombra al bajar y lleva dentro la línea de lectura. Incluye «Comprobar un archivo». |
| Botón | Primario, secundario, de texto o de peligro, planos, sin halo. |
| Campo | Etiqueta persistente, borde que toma la tinta al pasar el puntero, foco visible y error con una sacudida corta. |
| Tarjeta | Blanca sobre la lavanda, radio de 20 a 28 px y sombra con tinte violeta. |
| Aviso | Filete del color de su tono sobre un tinte suave, en claro y en oscuro. |
| Aviso de cookies | Tarjeta flotante en la esquina inferior izquierda; en celular, del ancho de la pantalla con margen. |
| Acceso | Foto bajo la tinta de la marca a la izquierda y el formulario a la derecha. Crear la cuenta con correo tiene el mismo peso que Google. |
| Espacio de trabajo | El inicio abre con una bienvenida sobre una foto; las pestañas del caso son Historial, Equipo, Tareas y plazos, Notas, Pruebas, Portal del cliente y Expediente. |
| Correo | Una columna, franja de tinta con filete de latón y logo del emblema. |
| Comprobante de pago | PDF A4 con Geist, Newsreader y Geist Mono incrustadas, el emblema, una franja de resumen y el total sobre tinta. |

## Verificación

- Recorrer con teclado la navegación, las acciones, los formularios y los diálogos.
- Revisar con Playwright y Microsoft Edge en escritorio (1440), tablet (834) y celular (390), en claro y en oscuro: contraste, controles sin nombre, desbordes y objetivos de menos de 24 px.
- Ejecutar `pnpm lint`, `pnpm test` y `pnpm build` en `frontend`. La carga inicial de JavaScript no pasa de 120 kB comprimidos y la de CSS de 36 kB.
