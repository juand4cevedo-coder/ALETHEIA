# Identidad y sistema de diseño

| Campo | Contenido |
| --- | --- |
| Estado | Implementación local del rediseño del 19 de noviembre de 2026 |
| Referencias | [Sobha Privy Collection](https://sobha-privy-collection.com/) y [Aerodynamics](https://www.aerodynamics.nl/) |
| Especificación | [Rediseño visual](rediseno-2026-11-19.md) |

## Color y tipografía

Los valores de interfaz residen en `frontend/src/styles/tokens.css`. La portada, el acceso, el espacio de trabajo y la consola comparten estas bases.

| Recurso | Valor | Aplicación |
| --- | --- | --- |
| Papel | `#F4F1EA` | Lienzo principal |
| Papel elevado | `#FFFFFF` | Paneles, campos y formularios |
| Papel hundido | `#E9E4D8` | Separaciones y superficies secundarias |
| Tinta | `#071423` | Acciones principales y secciones de contraste |
| Latón | `#7E5F36` sobre papel, `#C3A572` sobre tinta | Foco y acentos |
| Fraunces | Fuente editorial | Titulares de presentación |
| Inter | Fuente de interfaz | Formularios, datos y navegación |
| Geist Mono | Fuente monoespaciada | Radicados, huellas y valores técnicos |

## Componentes

| Elemento | Aplicación |
| --- | --- |
| Botón | Primario, secundario, de texto o circular según su función. El foco es visible y la variante compacta conserva 44 px de alto. |
| Campo | Etiqueta persistente, ayuda y error asociados al control. Fondo elevado y borde de control. |
| Tarjeta | Radio de 14 px, superficie clara y elevación para contenido agrupado. |
| Tabla | Las vistas de casos y auditoría adaptan sus filas a tarjetas en anchos estrechos. |
| Portada | Fraunces, una huella grabada en tinta y latón, y tramos de tinta con fotografías ornamentales. El fondo conserva el contraste aunque falle la imagen. |
| Acceso | Fotografía en banda móvil y en columna desde 900 px. El formulario conserva su propio espacio de lectura. |
| Cookies | Barra inferior con altura medida, área segura y espacio reservado al pie del contenido. |
| Correo | Plantilla de una columna, márgenes amplios, tipografía del sistema y acción en tinta. |

## Marca y recursos

| Uso | Archivo |
| --- | --- |
| Símbolo de interfaz | `frontend/src/assets/simbolo.svg` |
| Variantes de marca | `frontend/public/brand/symbol-dark.svg` y `symbol-white.svg` |
| Favicon y dispositivos | `frontend/public/favicon.svg`, `favicon.png` y `apple-touch-icon.png` |
| Correo | `frontend/public/email/logo-claro.png` |

Las imágenes WebP se alojan en el producto. Sus fuentes, dimensiones y derivados están en [Imágenes del producto](imagenes.md).

## Verificación

- Usar teclado para recorrer navegación, acciones, formularios y diálogos.
- Probar a 360, 600, 900 y 1200 px y con zoom al 200 %.
- Comprobar la lectura con movimiento reducido y si falla una fotografía.
- Ejecutar `pnpm lint`, `pnpm test` y `pnpm build` desde `frontend`. Los límites de entrada comprimida son 120 kB para JavaScript y 36 kB para CSS.
