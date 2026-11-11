# Identidad y sistema de diseño

| Campo | Contenido |
| --- | --- |
| Estado | Propuesto, 11/11/2026 |
| Reemplaza | La paleta azul y los efectos de luz de ADR-023 y ADR-041. Se conservan sus decisiones de estructura: espacio de trabajo oscuro, landing de una sola página y verificador público |
| Referencias | Resend, Better Stack y Revolut Business |
| Decisión | ADR-043 |

## 1. Principios

1. **El producto es la imagen.** La landing muestra la interfaz real de ALETHEIA en vez de ilustraciones. Las capturas usan datos de ejemplo verosímiles y no llevan la etiqueta «datos ficticios». Nunca se inventan clientes, testimonios, logotipos de firmas ni cifras de uso.
2. **El color significa algo.** El violeta marca la acción y el foco. El verde, el ámbar y el rojo dicen el estado de una evidencia y no se usan para nada más. Todo lo demás es grafito.
3. **Nada decorativo.** No hay focos de luz, halos, degradados radiales, bordes que brillan ni texturas. La profundidad sale de tres superficies y una línea.
4. **Cada elemento responde una pregunta del abogado.** Si una sección, un recuadro o un botón no la responde, se quita.
5. **Rápido por diseño.** Menos efectos es menos trabajo para el navegador. Presupuesto en la sección 8.

## 2. Logo

Se conserva la forma original: el triángulo imposible que forma la «A», con sus cuatro piezas (dos bandas, la base y el travesaño). Se rehízo como vector a partir del original y solo cambia el color.

| Uso | Bandas (degradado de volumen) | Travesaño |
| --- | --- | --- |
| Sobre fondo oscuro | `#F1F3F7` a `#8F98AA` | `#9B8EF8` a `#6B5BE6` |
| Sobre fondo claro | `#3A4150` a `#0D0F13` | `#7C6CF2` a `#5544D8` |

- Archivos: `frontend/src/assets/logo.svg` y `logo-claro.svg`; favicon en SVG con respaldo PNG de 32 px; ícono para iPhone de 180 px sobre `#0D0F13`; imagen para compartir (1200 × 630) regenerada.
- Junto al logo, el nombre se escribe «Aletheia» en Geist 600. En textos corrientes la marca se escribe ALETHEIA, como en los documentos del proyecto.
- Área libre mínima alrededor del logo: la altura del travesaño. Tamaño mínimo: 16 px.

## 3. Color

Todos los valores viven en `frontend/src/styles/tokens.css`. Ningún módulo usa un color suelto.

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#0D0F13` | Fondo de página |
| `--surface-1` | `#13161C` | Paneles, tarjetas, menú lateral |
| `--surface-2` | `#191D25` | Elementos sobre un panel: filas resaltadas, botón secundario |
| `--line` | `#232834` | Divisores y bordes de panel (decorativos) |
| `--line-control` | `#646D80` | Borde de campos y controles (contraste de 3:1 o más) |
| `--text` | `#EEF1F6` | Texto principal |
| `--text-2` | `#9AA3B2` | Texto secundario |
| `--text-3` | `#7D8799` | Texto de apoyo, etiquetas de columna |
| `--accent` | `#8B7CF6` | Botón principal, enlaces activos, foco |
| `--accent-strong` | `#B4A9FF` | Enlaces sobre texto, acento sobre `--surface-2` |
| `--on-accent` | `#0D0B1D` | Texto sobre el botón principal |
| `--ok` | `#3ECF8E` | Íntegra, verificado (solo cuando el sistema lo comprobó) |
| `--warn` | `#F2B33D` | Pendiente, sellando |
| `--err` | `#F2665A` | No coincide, error |

Contraste medido (WCAG 2.2): `--text` 14,9:1 a 16,9:1; `--text-2` 6,6:1 a 7,5:1; `--text-3` 4,7:1 a 5,3:1; `--accent` como texto 5,1:1 a 5,8:1; botón principal 5,8:1; estados 5,5:1 o más, sobre las tres superficies. El color nunca es la única señal: todo estado lleva texto.

## 4. Tipografía

- **Geist** para todo y **Geist Mono** para huellas, radicados, horas exactas y códigos. Se alojan en el propio sitio (`@fontsource-variable/geist` y `@fontsource-variable/geist-mono`), solo el subconjunto latino, con `font-display: swap` y precarga de Geist.
- Se retiran Inter, JetBrains Mono y Source Serif 4.

| Rol | Tamaño / interlineado | Peso | Espaciado |
| --- | --- | --- | --- |
| Titular de la landing | 56 / 60 (móvil 38 / 42) | 600 | -0,035 em |
| Título de sección | 36 / 42 (móvil 28 / 34) | 600 | -0,025 em |
| Título de pantalla | 28 / 34 | 600 | -0,02 em |
| Subtítulo | 18 / 28 | 500 | -0,01 em |
| Cuerpo | 15 / 24 | 400 | 0 |
| Interfaz | 14 / 20 | 400 y 500 | 0 |
| Apoyo | 13 / 18 | 400 | 0 |
| Etiqueta | 12 / 16 | 500 | 0 |
| Mono | 13 / 20 | 400 | 0 |

Se añaden como tokens (`--font-size-*`, `--line-height-*`) para que ningún módulo escriba tamaños sueltos.

## 5. Espacio, forma y profundidad

- Rejilla de 4 px. Escala de espacio existente (`--space-1` a `--space-24`).
- Radios: 6 px controles pequeños y etiquetas, 8 px botones y campos, 12 px paneles, 999 px insignias.
- Profundidad: solo las tres superficies y `--line`. Una única sombra, para menús y diálogos que flotan.
- Ancho de contenido: 1200 px; texto corrido a 64 caracteres como máximo.

## 6. Íconos

- **Phosphor** (`@phosphor-icons/react`), peso «regular», a 16 px en la interfaz y 20 px en encabezados. Su trazo y su geometría acompañan a Geist mejor que Lucide.
- Íconos propios, en el mismo trazo, solo para lo que es de ALETHEIA: huella, sello de tiempo, cadena de custodia y paquete.
- Un ícono acompaña un texto; nunca lo reemplaza, salvo en botones de ícono con nombre accesible.
- Se retira `lucide-react`.

## 7. Componentes

- **Botón principal:** violeta con texto oscuro. Uno por vista; es la acción que se espera.
- **Botón secundario:** `--surface-2` con borde `--line`. **Botón de texto:** para acciones terciarias.
- **Campos:** etiqueta encima, nunca flotante; ayuda debajo; el error reemplaza la ayuda y dice cómo corregirlo. Borde `--line-control`; foco con borde violeta y anillo de 3 px al 18 %.
- **Insignias de estado:** punto y texto. Gris para «Sin verificar», ámbar para pendiente, rojo para error y verde solo para lo verificado.
- **Tablas:** encabezado en `--text-3` 12 px, filas de 52 px, cifras con números tabulares, radicados y huellas en mono.
- **Movimiento:** 120 ms y 200 ms con `--ease-standard`. Solo para dar respuesta a una acción (abrir un menú, mostrar un error). Nada se anima solo. Con `prefers-reduced-motion`, nada se mueve.

## 8. Rendimiento

| Métrica | Meta |
| --- | --- |
| LCP en celular de gama media con 4G | Menos de 1,8 s |
| CLS | Menos de 0,05 |
| JavaScript inicial de la landing | Menos de 120 KB comprimido |
| CSS de la landing | Menos de 30 KB comprimido |
| Fuentes | Dos archivos woff2, subconjunto latino |

La landing no carga el código del espacio de trabajo. Las imágenes del producto se construyen en HTML y CSS, no como capturas.

## 9. Redacción

**Voz:** una colega abogada que sabe de tecnología y explica sin vender. Trata de «usted», en español de Colombia.

**Reglas que se revisan en cada texto:**

1. Sin caracteres que delatan una plantilla o un texto generado: el punto medio «·» como separador, «§», rayas «—», puntos suspensivos «…», flechas, el signo menos tipográfico en horas («UTC−5» se escribe «hora de Colombia»).
2. Frases de una idea, de 20 palabras como máximo en la interfaz y de 25 en la landing.
3. Nada de tríos con el mismo ritmo («rápido, seguro y confiable»), eslóganes vacíos ni superlativos («el mejor», «revolucionario»).
4. Cada botón dice exactamente lo que pasa al pulsarlo: «Abrir el caso», no «Continuar».
5. Los errores dicen qué pasó y cómo seguir, sin culpar a la persona.
6. Los números se escriben como en Colombia: 2,4 MB; 15 de octubre de 2026; 10:39 a. m.
7. Nunca se afirma algo que el sistema no hace todavía o no comprobó. ALETHEIA preserva y documenta; no certifica ni decide sobre la validez de una prueba.
8. Cifras, clientes y testimonios solo si son reales.

**Separadores en la interfaz:** en lugar de «·», se usa la estructura (dos líneas, una columna, una etiqueta) o una coma cuando el texto lo pide.

## 10. Alcance de la aplicación

1. Tokens, fuentes, íconos y logo.
2. Landing: se rehace con la estructura de la sección 11.
3. Espacio de trabajo: marco, menú, Casos, Abrir un caso, página del caso, Miembros y Mi cuenta.
4. Acceso: ingresar, crear cuenta, recuperar contraseña y verificar correo.
5. Páginas legales, de precios y de error.
6. Correos transaccionales: colores y logo sobre fondo claro.

## 11. Estructura de la landing

Cada sección responde una pregunta. Se quitan los números de sección y el recuadro blanco del alcance.

| Sección | Pregunta que responde |
| --- | --- |
| Inicio | ¿Qué es y por qué me sirve? Titular, una frase de apoyo, dos botones y la interfaz del caso como imagen |
| El problema | ¿Por qué no basta con una captura de pantalla? |
| Cómo funciona | ¿Qué pasa con mi archivo desde que lo subo? Cuatro pasos sobre la interfaz real |
| Lo que se puede comprobar | ¿Cómo sé que nadie lo alteró? La demostración de la huella y la cadena |
| Alcance | ¿Qué hace y qué no hace? Dos columnas con el mismo estilo de panel, sin recuadros de otro color |
| Verificador | ¿Puede comprobarlo la contraparte sin una cuenta? |
| Precios | ¿Cuánto cuesta? |
| Preguntas frecuentes | Las dudas que quedan |
| Cierre | Una sola acción |

## 12. Documentos que se actualizan

- `Diseno_UX_UI_y_Sistema_de_Diseno` (Drive, 03_Diseño): secciones de identidad, tokens (sección 12), componentes y el catálogo de mensajes (sección 14), con las reglas de redacción.
- `Arquitectura_Datos_y_Diseno_Tecnico` (Drive, 03_Diseño): dependencias del frontend (fuentes e íconos) y presupuesto de rendimiento.
- ADR-043 en el repositorio.
