# Dirección visual integral de Aletheia

## Decisión

El sitio público adopta una dirección clara, enérgica y fluida, adaptada a la identidad
y al producto de Aletheia. Los textos, fotografías, ilustraciones y signos distintivos
son propios o cuentan con la licencia documentada en el repositorio.

Esta dirección reemplaza la estética editorial sobria de marfil, azul oscuro y tipografía
con serif definida el 19 de noviembre. Se aplica tanto a las páginas públicas como al
espacio autenticado: no se mantienen paneles internos de la generación visual anterior.

## Principios visuales

- Tipografía sans serif de gran escala, compacta y directa.
- Violeta Aletheia `#820AD1` como color primario, blanco y gris claro como superficies,
  negro casi puro para texto y violeta profundo `#5F007D` para contraste.
- Secciones amplias, menos elementos simultáneos y una acción dominante por bloque.
- Tarjetas grandes de 20 a 28 píxeles de radio y botones tipo píldora.
- Fotografía real, actual, luminosa y con color. No se publican imágenes generadas ni
  rostros sintéticos.
- Movimiento breve al entrar, transiciones de 180 a 240 ms y respeto obligatorio por
  `prefers-reduced-motion`.

## Marca

El símbolo es un ojo blanco sobre un recuadro violeta de esquinas redondeadas, con una variante invertida y otra reducida para 16 y 32 px. Reemplaza al círculo con circuitos, que dejaba de leerse por debajo de 40 px (ADR-049). El detalle de los archivos está en [Identidad y sistema de diseño](identidad-y-sistema-de-diseno.md).

## Arquitectura pública

El encabezado reduce la carga a cuatro grupos con megamenú y una ruta directa:

1. Producto
2. Equipos
3. Recursos
4. Aletheia
5. Precios

Cada grupo abre un panel único con una fotografía, una frase breve y hasta cuatro
enlaces. En móvil, el mismo contenido se presenta en dos niveles dentro de un diálogo.

Las rutas públicas continúan separadas —producto, equipos, documentación, ayuda,
compañía, precios y artículos— para evitar una sola portada interminable. La portada
funciona como resumen y distribuidor, no como sustituto de esas páginas.

## Criterios de aceptación

- El hero usa fotografía real a sangre completa y un título sans serif de alto impacto.
- La navegación funciona con puntero, teclado, Escape y diálogo móvil.
- Los menús y tarjetas no crean rutas sin contenido.
- El sitio mantiene el alcance real del producto y no promete certificación, validez
  probatoria ni resultados jurídicos.
- Las imágenes publicadas tienen fuente y licencia documentadas en `imagenes.md`.
- La portada y las plantillas públicas pasan pruebas, lint, compilación y revisión
  visual en escritorio y móvil antes de producción.
