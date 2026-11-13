# Rediseño de la landing pública: dirección «Expediente»

Fecha: 10/11/2026 · Rama: `feature/landing-expediente` · Base: `develop`

## 1. Objetivo

Que la landing deje de leerse como una plantilla SaaS y transmita, al primer vistazo, rigor
forense y jurídico. Un abogado o perito debe entender en segundos que ALETHEIA conserva el
original, lo sella y documenta su custodia, y poder **ver** esa prueba funcionando.

Criterios de éxito:

1. El ritmo entre secciones varía (composición, escala y densidad), sin repetir el molde
   «etiqueta + H2 centrado + párrafo + cuadrícula».
2. La página tiene voz tipográfica propia: serif para el narrador, Inter para la interfaz y
   JetBrains Mono para los datos.
3. La huella SHA-256, la cadena de custodia encadenada y el sello RFC 3161 forman la pieza
   visual central y se pueden probar en la página.
4. El hero se conserva (mismo texto y la misma vista del caso) y gana presencia.
5. Ningún contenido depende de una animación para verse: un salto de desplazamiento nunca
   deja la pantalla vacía.
6. La página se ve viva sin saturar: el movimiento y la luz siguen el presupuesto de la
   sección 5.
7. AA con axe, teclado y `prefers-reduced-motion`; CSP de `infra/Caddyfile` intacta; texto
   legal y alcance con el mismo sentido; español de Colombia con «usted».
8. `pnpm --dir frontend test`, `lint`, `format:check` y `build` en verde; revisión en el
   navegador a 1440 × 900 y a 375 px.

## 2. Restricciones y decisiones previas

- **ADR-023 se respeta:** todo el sitio público va sobre un solo fondo oscuro
  (`ink.950` a `ink.900`), sin bandas claras. La única superficie clara es un *objeto* (la
  hoja de expediente del Alcance), no un fondo de sección.
- **ACC-001:** `color.brand.blue` y los degradados nunca llevan texto. No hay texto con
  degradado.
- **CSP:** sin estilos ni scripts en línea. Las variables dinámicas se escriben con CSSOM
  (`element.style.setProperty`), como ya hace `useSpotlight`. Las fuentes van con
  `@fontsource`.
- **Alcance de archivos:** `frontend/src/pages/HomePage.*`, `frontend/src/features/landing/*`,
  `frontend/src/layouts/PublicLayout.*`, `frontend/src/components/ui/Reveal.*` (solo lo usa
  la landing), `frontend/src/styles/tokens.css`, `frontend/src/main.tsx` (importar la
  fuente), `frontend/package.json` y el lockfile, y un ADR nuevo. Nada del espacio de trabajo
  ni del backend.
- **Títulos que fijan las pruebas:** se conservan tal cual el H1, «De la recepción del archivo
  al expediente, en cuatro pasos», «Preservamos y documentamos. La valoración es del juez.»,
  «No certificamos pruebas ni determinamos su validez.», los planes, la FAQ y el menú.

## 3. Sistema visual

### Tipografía

- **Display serif: Source Serif 4 Variable** (`@fontsource-variable/source-serif-4` 5.3.1,
  solo el subconjunto latino). Se usa en el H1, los H2 y los números de folio grandes. Es la
  voz de las sentencias y los dictámenes; tiene eje óptico para los tamaños grandes y buena
  legibilidad en pantalla. El peso va de 500 a 600 y la letra no se condensa.
- **Inter** se queda para el cuerpo, los botones y la navegación. **JetBrains Mono** se
  queda para las huellas, las horas y los identificadores.
- Nuevo token `--font-display`.

### Encabezado de sección con folio

`SectionHeading` deja de centrar. Pasa a una retícula de dos columnas en escritorio:

- a la izquierda, el folio «§ 02» en mono pequeño y una regla fina;
- a la derecha, el H2 en serif (44–56 px) y la entrada en Inter.

En 375 px las columnas se apilan. La etiqueta (`kicker`) se mantiene como texto pequeño junto
al folio. Justificación: un expediente se folia, y la alineación a la izquierda lee como un
documento y no como un anuncio.

### Color y luz

- El fondo sigue siendo continuo. Se reparten de nuevo los focos radiales para que cada
  sección tenga su luz, con uno más intenso detrás de la pieza central.
- Nuevos tokens: `--color-paper` (#F3EFE6), `--color-paper-ink` (#1B2333) y
  `--color-paper-rule` (#CFC6B4) para la hoja de expediente. Se mide el contraste del texto
  sobre el papel y se registra en el ADR (meta ≥ 7:1 para el cuerpo).

## 4. Secciones

| § | Sección | Composición nueva |
| --- | --- | --- |
| — | Hero | Mismo texto. El H1 pasa a serif. `EvidencePreview` crece y se le superpone una ficha pequeña del sello RFC 3161, con hora y autoridad, que «se estampa» una sola vez al cargar. La ventana tiene un borde de luz que gira despacio (la única animación continua de la página). |
| 01 | Problema | El título y la entrada a la izquierda; a la derecha, los tres problemas como una lista numerada con reglas finas, sin tarjetas. La cita del CGP y la C-604 de 2016 va como nota al pie del documento. |
| 02 | Cómo funciona | Una línea de tiempo horizontal de cuatro hitos unidos por un conector que se llena al desplazarse. En 375 px pasa a vertical. Son pasos en secuencia, no cuatro cosas paralelas. |
| 03 | Garantías (pieza central) | Mantiene el H2 «Garantías que cualquier perito puede comprobar». A todo el ancho, con tres demostraciones: **A. Huella:** un texto de ejemplo editable (`<textarea>` con su rótulo); la SHA-256 se recalcula con `crypto.subtle.digest` en el navegador, los caracteres que cambian respecto de la huella original se resaltan y el estado «Coincide / No coincide» se anuncia en `aria-live="polite"`; incluye un botón para restaurar el texto. **B. Cadena:** cuatro eventos de custodia, cada uno con su huella y la del anterior, unidos por eslabones; el botón «Alterar el evento 2» (con `aria-pressed`) cambia ese registro y desde ahí la cadena se marca rota, con el estado anunciado. **C. Sello:** una ficha con los campos reales de un sello RFC 3161 (hora, huella sellada, política y autoridad) con datos ficticios rotulados como tales. Debajo, Cifrado por caso y Eliminación con constancia como una lista compacta de dos columnas. |
| 04 | Alcance | La hoja de expediente: una superficie de papel con folio, márgenes, la marca del logo como filigrana muy tenue y dos columnas «Lo que hacemos / Lo que no hacemos» separadas por una regla. La nota de la autoridad judicial va al pie de la hoja. El texto no cambia. |
| 05 | Verificador | Se conserva la estructura; los tres pasos quedan como una secuencia con conector, coherente con § 02. |
| 06 | Planes | Mismo `PlanSummary`, con el nuevo encabezado con folio. |
| 07 | Preguntas | Dos columnas: el título fijo (`position: sticky`) a la izquierda y los `<details>` a la derecha. |
| — | Cierre | Un panel amplio con la luz más intensa de la página detrás; el título en serif. Mismo texto y mismos botones. |

Los textos nuevos de la pieza central se limitan a explicar las demostraciones con lo que el
producto ya afirma en la FAQ y en Estándares. No se agregan cifras, clientes ni testimonios.
Los datos de ejemplo se rotulan «Datos ficticios».

`PublicLayout`: solo los ajustes que exija la nueva tipografía (por ejemplo, alinear el
logotipo con el folio). No se reescribe.

## 5. Efectos y movimiento: presupuesto

Cada efecto comunica algo del producto. Los que no comunican nada no entran.

| Efecto | Qué comunica | Tipo |
| --- | --- | --- |
| Entrada ligada al desplazamiento (`animation-timeline: view()`): opacidad de 0,6 a 1 y 12 px de subida | Orden de lectura | Ligado al desplazamiento; nunca deja contenido oculto |
| Regla del folio que se dibuja (`scaleX`) | Paso a una sección nueva | Ligado al desplazamiento |
| Conector de los cuatro pasos que se llena | Progresión del proceso | Ligado al desplazamiento |
| Borde de luz del hero que gira lento (unos 14 s por vuelta) | Evidencia protegida y en vivo | La única animación continua |
| Ficha del sello que se estampa (escala de 1,04 a 1, una sola vez) | El sello lo emite un tercero | Al cargar |
| Destello de los caracteres que cambian en la huella | Un cambio mínimo produce otra huella | Responde a lo que escribe el usuario |
| Pulso de luz que recorre la cadena una vez al entrar | Los eventos están encadenados | Una sola vez |
| Eslabón roto en `error.400` | Alterar un registro rompe la cadena | Responde al usuario |
| Luz que sigue al puntero (`useSpotlight`), solo en las superficies interactivas de la pieza central | Se puede manipular | Al pasar el puntero |

Reglas:

- Solo `transform` y `opacity` en las animaciones (y `background-position` en el borde del
  hero). Nada de blur animado.
- Ninguna animación supera 700 ms, salvo el borde del hero.
- Con `prefers-reduced-motion: reduce` todo queda en su estado final y el borde del hero se
  detiene.
- Sin `@supports (animation-timeline: view())`, el contenido se ve completo y estático.
- Nada de parallax sobre el texto, partículas, ni texto con degradado.

## 6. Corrección de `Reveal`

Hoy `Reveal` arranca con `opacity: 0` y espera a que el 15 % del elemento entre en pantalla,
con una transición de 700 ms. Al desplazarse rápido, la pantalla queda vacía (verificado a
1440 × 900). La nueva versión renderiza el contenido visible desde el inicio y aplica la
entrada solo con CSS ligado al desplazamiento, dentro de
`@supports (animation-timeline: view())` y
`@media (prefers-reduced-motion: no-preference)`. Desaparecen el IntersectionObserver, el
estado `pending` y los retrasos escalonados. La API (`as`, `className`) se mantiene para no
tocar a los que lo llaman; `delay` se elimina.

## 7. Componentes

- `features/landing/SectionHeading.tsx`: recibe el folio (`index`) y queda alineado a la
  izquierda.
- `features/landing/IntegrityDemo.tsx` (nuevo): orquesta las tres demostraciones de § 03.
  - `HashDemo.tsx`: el texto editable, `useSha256(text)` y el resaltado por carácter.
  - `ChainDemo.tsx`: los cuatro eventos, el estado `altered` y el cálculo de dónde se rompe.
  - `StampCard.tsx`: la ficha RFC 3161; se reutiliza en pequeño en el hero.
- `features/landing/useSha256.ts` (nuevo): envuelve `crypto.subtle.digest`. Mientras calcula
  o si Web Crypto no existe, muestra la última huella conocida y precalculada; el texto de
  ejemplo trae su huella real fija en el código.
- Las huellas de la cadena son SHA-256 reales de cada registro concatenado con la huella del
  anterior, precalculadas en el código y verificadas por una prueba.

## 8. Pruebas

Se mantienen todas las pruebas de `HomePage.test.tsx`, incluido el recorrido con el teclado y
axe. Se agregan:

- `HashDemo`: al editar, la huella cambia, el estado pasa a «No coincide» y se anuncia; al
  restaurar, vuelve a «Coincide». La huella del texto de ejemplo es la SHA-256 real.
- `ChainDemo`: al pulsar «Alterar el evento 2», `aria-pressed` cambia y los eventos 2 a 4 se
  marcan rotos; las huellas precalculadas encadenan de verdad.
- `Reveal`: el contenido está visible al montar, sin `data-state="pending"`.

Revisión en el navegador: a 1440 × 900 y a 375 px, con un salto de desplazamiento al final
(sin zonas vacías), el teclado por la pieza central, el movimiento reducido emulado y el
contraste del papel.

## 9. ADR

Un ADR nuevo, con el número siguiente disponible en `develop` al abrir el PR, que complementa
el ADR-023. Recoge la fuente serif como dependencia (con su peso en kB), la hoja de papel
como única superficie clara (con su contraste medido), el cambio de `Reveal` a animaciones
ligadas al desplazamiento y el presupuesto de movimiento.

## 10. Fuera de alcance

Las pantallas internas, el backend, la página de precios (salvo lo que herede de
`PlanSummary`), el verificador real (HU-026) y los textos legales.
