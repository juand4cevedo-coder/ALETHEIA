# Identidad y sistema de diseño

| Campo | Contenido |
| --- | --- |
| Estado | Vigente desde el 22 de noviembre de 2026 |
| Decisión | [ADR-049](../adr/adr-049.md) |
| Dirección visual | [Dirección visual integral](redisenio-integral-2026-11-21.md) |

## Color y tipografía

Los valores residen en `frontend/src/styles/tokens.css`, la única fuente de la paleta. El sitio público, el acceso y el espacio de trabajo la heredan; cada marco solo ajusta fondos y radios.

| Token | Valor | Aplicación |
| --- | --- | --- |
| `--paper` | `#FFFFFF` (`#F7F7F7` en el espacio de trabajo) | Lienzo principal |
| `--paper-raised` | `#FFFFFF` | Paneles, campos y formularios |
| `--paper-sunken` | `#F4F4F4` (`#EEEAF2` en el espacio de trabajo) | Separaciones y superficies secundarias |
| `--ink-900` | `#820AD1` | Marca: acciones principales y superficies de marca |
| `--ink-700` | `#5F007D` | Violeta profundo para contraste |
| `--ink-500` | `#7209B7` | Enlaces y foco |
| `--brass-400` | `#D9A6F7` | Acento claro sobre superficies de marca |
| `--text`, `--text-2`, `--text-3` | `#111111`, `#4B4B4B`, `#676767` | Texto, con contraste AA sobre las tres superficies |
| `--ok`, `--warn`, `--err` | `#1F6B4A`, `#8A5A18`, `#9B2226` | Estados, siempre acompañados de texto |
| Inter | Fuente de interfaz | Titulares, formularios, datos y navegación |
| Geist Mono | Fuente monoespaciada | Radicados, huellas y valores técnicos |

Los nombres vienen de una identidad anterior y se conservan a propósito: ink es la marca, brass su acento y paper las superficies. Una prueba (`tokens.test.ts`) falla si algún `var(--nombre)` no tiene definición y si un valor semántico cambia sin pasar por el ADR.

## Movimiento

| Elemento | Comportamiento |
| --- | --- |
| Cambio de página | Cada ruta monta su `<main>` con un fundido y un desplazamiento de 10 px en 240 ms (`.page-enter`). |
| Diálogos | Fundido, ascenso de 18 px y crecimiento suave al abrir y al cerrar, con fondo velado y desenfocado. En el celular suben desde abajo como una hoja con asa de arrastre. |
| Botones | Cambian de color en 180 ms y ceden a 97 % al presionarlos. |
| Movimiento reducido | Con `prefers-reduced-motion` las duraciones bajan a 1 ms y no hay desplazamientos. |

## Componentes

| Elemento | Aplicación |
| --- | --- |
| Botón | Primario, secundario, de texto o circular según su función. El foco es visible y la variante compacta conserva 44 px de alto. |
| Campo | Etiqueta persistente, ayuda y error asociados al control. Fondo elevado y borde de control. |
| Tarjeta | Radio de 24 px, superficie clara y elevación para contenido agrupado. |
| Tabla | Las vistas de casos y auditoría adaptan sus filas a tarjetas en anchos estrechos. |
| Acceso | Fotografía en banda móvil y en columna desde 900 px. El formulario conserva su propio espacio de lectura. |
| Cookies | Barra inferior con altura medida, área segura y espacio reservado al pie del contenido. Más compacta en teléfono. |
| Correo | Plantilla de una columna, márgenes amplios, tipografía del sistema y acción en violeta. |

## Marca y recursos

El símbolo es un ojo blanco sobre un recuadro violeta de esquinas redondeadas. El iris marca el punto donde se fija la huella de cada archivo.

| Uso | Archivo |
| --- | --- |
| Símbolo de interfaz | `frontend/src/assets/simbolo.svg` |
| Variantes de marca | `frontend/public/brand/symbol-dark.svg` (violeta) y `symbol-white.svg` (invertida) |
| Favicon y dispositivos | `frontend/public/favicon.svg`, `favicon.ico`, `favicon.png`, `apple-touch-icon.png`, `icon-192.png` e `icon-512.png` |
| Correo | `frontend/public/email/logo-claro.png` |
| Imagen social | `frontend/public/og-image.png`, con su fuente vectorial en `docs/diseno/og-image.svg` |

Las imágenes WebP se alojan en el producto. Sus fuentes, dimensiones y derivados están en [Imágenes del producto](imagenes.md).

## Verificación

- Usar teclado para recorrer navegación, acciones, formularios y diálogos.
- Probar a 360, 600, 900 y 1200 px y con zoom al 200 %.
- Comprobar la lectura con movimiento reducido y si falla una fotografía.
- Ejecutar `pnpm lint`, `pnpm test` y `pnpm build` desde `frontend`. Los límites de entrada comprimida son 120 kB para JavaScript y 36 kB para CSS.
