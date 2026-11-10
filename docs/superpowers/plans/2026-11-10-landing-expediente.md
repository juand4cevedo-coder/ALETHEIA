# Landing «Expediente»: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la landing pública con voz editorial, fondo oscuro continuo y una pieza
central de prueba en vivo (huella, cadena y sello), sin que el contenido dependa de la
animación.

**Architecture:** Componentes de presentación en `frontend/src/features/landing/` con CSS
Modules y tokens. Las demostraciones calculan SHA-256 con Web Crypto en el navegador y usan
valores precalculados como respaldo. Las entradas son CSS ligado al desplazamiento, sin
JavaScript.

**Tech Stack:** React 19, TypeScript, Vite, CSS Modules, Vitest + Testing Library + axe,
`@fontsource-variable/source-serif-4` 5.3.1.

**Spec:** `docs/superpowers/specs/2026-11-10-landing-expediente-design.md`

## Global Constraints

- Fondo oscuro continuo (ADR-023). La única superficie clara es la hoja de Alcance.
- Sin estilos ni scripts en línea (CSP): nada de `style={…}`; las variables dinámicas se
  escriben con `element.style.setProperty` dentro de un efecto.
- Ningún texto con degradado ni en `--color-brand-blue` (ACC-001).
- Animaciones: solo `transform` y `opacity` (más `background-position` en el borde del hero),
  como máximo 700 ms salvo el borde del hero, y todo quieto con `prefers-reduced-motion`.
- Las entradas van dentro de `@supports (animation-timeline: view())` y
  `@media (prefers-reduced-motion: no-preference)`.
- Español de Colombia, trato de «usted». Ninguna cifra, cliente ni testimonio inventado. Los
  datos de ejemplo se rotulan «Datos ficticios».
- No cambian los títulos ni los textos que verifica `HomePage.test.tsx`.
- Commits `feat(frontend): …` o `docs(docs): …`, terminados en
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No se confirma `.claude/launch.json` (es local de esta copia).
- Comando de verificación completa: `pnpm --dir frontend test && pnpm --dir frontend lint && pnpm --dir frontend format:check && pnpm --dir frontend build`.

## Review Focus

1. **Texto vacío en la demostración de la huella:** la SHA-256 de "" es
   `e3b0c442…b855`; se muestra esa huella con «No coincide», sin errores. Prueba en la tarea 4.
2. **Escritura rápida:** un cálculo viejo que termina después de uno nuevo no debe pisar la
   huella actual. Prueba en la tarea 4 (descartar resultados obsoletos).
3. **Sin Web Crypto** (contexto HTTP no seguro): la demostración muestra la huella
   precalculada y un aviso de que no se puede recalcular, sin romper la página. Prueba en la
   tarea 4.
4. **Teclado en la pieza central:** el `textarea`, «Restaurar el texto» y «Alterar el
   evento 2» se alcanzan en orden; la prueba de recorrido existente lo cubre si se respeta el
   orden del documento (tarea 5).
5. **Huellas largas en 375 px:** las huellas de 64 caracteres se parten en bloques y no
   desbordan; se revisa en la tarea 8 con el navegador (`scrollWidth <= innerWidth`).

---

### Task 1: Fuente serif y tokens

**Files:**
- Modify: `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/src/main.tsx:1-3`,
  `frontend/src/styles/tokens.css`

- [ ] **Step 1:** `pnpm --dir frontend add @fontsource-variable/source-serif-4@5.3.1 --save-exact`
- [ ] **Step 2:** Importar `@fontsource-variable/source-serif-4` en `main.tsx`, después de
  JetBrains Mono.
- [ ] **Step 3:** En `tokens.css`, agregar
  `--font-display: "Source Serif 4 Variable", "Iowan Old Style", Georgia, serif;`,
  `--color-paper: #f3efe6;`, `--color-paper-ink: #1b2333;`, `--color-paper-muted: #4a4f5c;`
  y `--color-paper-rule: #cfc6b4;`.
- [ ] **Step 4:** `pnpm --dir frontend build`. Esperado: compila y `dist/assets` incluye un
  `source-serif-4-latin-*.woff2`.
- [ ] **Step 5:** Commit `feat(frontend): agregar la fuente serif y los tokens del papel`.

### Task 2: `Reveal` sin contenido oculto

**Files:**
- Modify: `frontend/src/components/ui/Reveal.tsx`, `frontend/src/components/ui/Reveal.module.css`,
  y quitar la prop `delay` en todos los usos dentro de `frontend/src/features/landing/`
- Create: `frontend/src/components/ui/Reveal.test.tsx`

**Interfaces:**
- Produces: `Reveal({ children, className?, as?: "div" | "li" })`, sin `delay` ni estado.

- [ ] **Step 1: Prueba**

```tsx
it("muestra el contenido desde el primer render", () => {
  render(<Reveal>Texto</Reveal>);
  const el = screen.getByText("Texto");
  expect(el).toBeVisible();
  expect(el).not.toHaveAttribute("data-state");
});
```

- [ ] **Step 2:** `pnpm --dir frontend test Reveal`. Esperado: FALLA (hoy existe
  `data-state`).
- [ ] **Step 3:** El componente solo renderiza `Tag` con `className={styles.reveal}` más el
  que reciba. El CSS es `.reveal { animation: reveal-in linear both;
  animation-timeline: view(); animation-range: entry 0% entry 60%; }`, con
  `@keyframes reveal-in { from { opacity: 0.6; transform: translateY(12px); } }`, todo dentro
  de las dos condiciones de Global Constraints.
- [ ] **Step 4:** La prueba pasa y `pnpm --dir frontend build` compila (sin la prop `delay`).
- [ ] **Step 5:** Commit `feat(frontend): mostrar el contenido de la landing sin esperar la animación`.

### Task 3: Encabezado con folio y base de sección

**Files:**
- Modify: `frontend/src/features/landing/SectionHeading.tsx`, `Section.module.css`, y
  cada sección que lo usa
- Test: `frontend/src/pages/HomePage.test.tsx` (agregar)

**Interfaces:**
- Produces: `SectionHeading({ id, index: number, kicker, title, lead? })`. El folio se
  renderiza como `<p className={styles.folio} aria-hidden="true">§ 0{index}</p>`, y la
  etiqueta sigue siendo texto visible.
- Folios: Problema 1, Cómo funciona 2, Garantías 3, Alcance 4, Verificador 5, Planes 6,
  Preguntas 7.

- [ ] **Step 1: Prueba:** «los H2 de la landing usan el orden de folios»: dentro de `main`,
  los H2 aparecen en el orden Problema, Cómo funciona, Garantías, Alcance, Verificador,
  Planes, Preguntas y Cierre (`getAllByRole("heading", { level: 2 })` y comparar textos).
- [ ] **Step 2:** Pasa sin cambios (guarda el orden). Si falla, el orden actual difiere: se
  corrige antes de seguir.
- [ ] **Step 3:** Implementar la retícula `minmax(160px, 0.32fr) 1fr` en escritorio (en
  ≤ 760 px, una sola columna). H1 y H2 con `font-family: var(--font-display)`,
  `font-weight: 560`, H2 de 52/58 px en escritorio y 34/40 px en móvil. La regla del folio,
  `::after` con `scaleX` animado por `view()`. Quitar el `::before` centrado de `.section`.
- [ ] **Step 4:** Verificación completa en verde.
- [ ] **Step 5:** Commit `feat(frontend): encabezados de sección con folio y voz serif`.

### Task 4: `useSha256` y demostración de la huella

**Files:**
- Create: `frontend/src/features/landing/useSha256.ts`, `HashDemo.tsx`, `HashDemo.module.css`,
  `HashDemo.test.tsx`

**Interfaces:**
- Produces: `sha256Hex(text: string): Promise<string>`;
  `useSha256(text: string, fallback: string): { hash: string; supported: boolean }`;
  `SAMPLE_TEXT = "Acepto la oferta y firmo el contrato el lunes."`;
  `SAMPLE_HASH = "2423c674b991b77295651978758e9e384f3215d43e83daef9643fb9fd193254e"`;
  `<HashDemo />`.

- [ ] **Step 1: Pruebas** (en `HashDemo.test.tsx`)
  - `SAMPLE_HASH` es igual a `createHash("sha256").update(SAMPLE_TEXT).digest("hex")` (de
    `node:crypto`).
  - Al montar se ve «Coincide» y el texto de `SAMPLE_TEXT` en el `textbox` con nombre «Texto
    de ejemplo».
  - Al cambiar «lunes» por «martes»: `findByText("No coincide")`, y la región
    `role="status"` contiene «No coincide».
  - Al pulsar «Restaurar el texto», vuelve «Coincide».
  - Con el texto vacío se muestra `e3b0c442` (primer bloque) y «No coincide».
  - Con `vi.stubGlobal("crypto", {})` se muestra `SAMPLE_HASH` y el aviso «Su navegador no
    permite recalcular la huella en esta página.».
- [ ] **Step 2:** Ejecutar. Esperado: FALLA (el módulo no existe).
- [ ] **Step 3:** Implementar. `useSha256` descarta resultados obsoletos con un contador de
  solicitudes dentro del efecto. La huella se muestra en 8 bloques de 8; cada carácter que
  difiere de `SAMPLE_HASH` en su posición lleva la clase `changed` (destello de 600 ms con
  `opacity`). La huella original queda fija arriba y la actual abajo.
- [ ] **Step 4:** Las pruebas pasan.
- [ ] **Step 5:** Commit `feat(frontend): demostrar en la landing cómo cambia la huella SHA-256`.

### Task 5: Cadena, sello y pieza central

**Files:**
- Create: `frontend/src/features/landing/ChainDemo.tsx`, `ChainDemo.module.css`,
  `ChainDemo.test.tsx`, `StampCard.tsx`, `StampCard.module.css`, `IntegrityDemo.module.css`
- Modify: `frontend/src/features/landing/StandardsSection.tsx`, `StandardsSection.module.css`

**Interfaces:**
- Consumes: `HashDemo` (tarea 4), `SectionHeading` (tarea 3).
- Produces: `CHAIN_EVENTS: { time: string; text: string; hash: string }[]` (los cuatro
  eventos de `EvidencePreview`); `chainRecord(prev: string, time: string, text: string) =
  `${prev}|${time}|${text}``; `GENESIS = "0".repeat(64)`;
  `<StampCard size?: "full" | "compact" />`; `<ChainDemo />`.
- Huellas: `1e9b138e…97ab`, `aef76633…c186`, `1f03bd6e…2391`, `1d6b111b…0b27` (los valores
  completos se calculan con la regla de `chainRecord` y la prueba los fija).
- Evento 2 alterado: la hora pasa de `10:39:05` a `08:15:00` (antedatarlo).

- [ ] **Step 1: Pruebas**
  - Cada `CHAIN_EVENTS[i].hash` es igual a la SHA-256 de `chainRecord(prev, time, text)`,
    con `prev` igual a `GENESIS` o a la huella anterior.
  - El botón «Alterar el evento 2» tiene `aria-pressed="false"`; al pulsarlo pasa a `"true"`,
    el estado anuncia «La cadena se rompe en el evento 2» y los elementos de la lista 2, 3
    y 4 tienen `data-broken="true"`; al pulsarlo de nuevo, todo vuelve.
- [ ] **Step 2:** Ejecutar. Esperado: FALLA.
- [ ] **Step 3:** Implementar `ChainDemo` (una lista `<ol>` con eslabones; el pulso de luz
  de entrada es `::after` animado por `view()`). `StampCard` muestra Hora
  `15/10/2026, 10:39:07 (hora de Colombia)`, Huella sellada `52a910d4…a6f5` (con `Hash`
  abreviado), Política `RFC 3161` y Autoridad `Autoridad de sellado externa`, más el rótulo
  «Datos ficticios». En `StandardsSection` se conservan el H2 y la entrada; debajo van tres
  paneles (Huella, Cadena y Sello) y luego Cifrado por caso y Eliminación con constancia
  como lista de dos columnas con los textos actuales. `useSpotlight` solo sobre los tres
  paneles.
- [ ] **Step 4:** Verificación completa en verde (incluidos el recorrido con el teclado y
  axe de `HomePage.test.tsx`).
- [ ] **Step 5:** Commit `feat(frontend): poner la prueba de integridad en el centro de la landing`.

### Task 6: Hero elevado

**Files:**
- Modify: `frontend/src/features/landing/Hero.tsx`, `Hero.module.css`, `EvidencePreview.module.css`

- [ ] **Step 1:** El H1 en `--font-display`, de 76/80 px en escritorio y 44/48 px en móvil;
  el texto no cambia.
- [ ] **Step 2:** Envolver la vista previa en un marco con borde de luz: un `::before` con
  `conic-gradient` de `--color-primary-400` y `--color-brand-blue`, enmascarado al borde,
  rotando una vez cada 14 s (`@property --angle` o rotación del pseudoelemento) y detenido
  con movimiento reducido.
- [ ] **Step 3:** Superponer `<StampCard size="compact" />` en la esquina inferior derecha
  de la ventana (en ≤ 760 px va debajo, sin superponerse), con la entrada «estampada»
  (`scale` de 1,04 a 1 y `opacity` de 0 a 1, 500 ms, con un retraso de 900 ms) solo al cargar.
- [ ] **Step 4:** Verificación completa en verde.
- [ ] **Step 5:** Commit `feat(frontend): dar más presencia al caso de ejemplo del hero`.

### Task 7: Resto de secciones y fondo

**Files:**
- Modify: `ProblemSection.*`, `HowItWorks.*`, `ScopeSection.*`, `VerifierSection.*`,
  `FaqSection.*`, `ClosingSection.*`, `PlansSection.*` en `frontend/src/features/landing/`,
  `frontend/src/pages/HomePage.module.css`

- [ ] **Step 1: Problema:** encabezado a la izquierda y, a la derecha, una lista numerada
  (`01`–`03` en `--font-display`) con reglas `--color-ink-700`, sin tarjetas. La cita como
  nota al pie bajo una regla. Se quita `useSpotlight` de esta sección.
- [ ] **Step 2: Cómo funciona:** la `<ol>` como línea de tiempo con un conector `::before`
  cuyo `scaleX` (en móvil, `scaleY`) sigue a `view()`; los hitos son puntos con el ícono.
- [ ] **Step 3: Alcance:** `.sheet` con `--color-paper` de fondo y `--color-paper-ink` de
  texto, `padding` de 64 px (24 px en móvil), folio «Fol. 04» en mono, una regla vertical
  entre las columnas y la marca `aletheia-mark.png` como filigrana `::after` al 4 % de
  opacidad. Los íconos de sí y no usan `--color-success-600` y un rojo oscuro con contraste
  ≥ 4,5:1 sobre el papel (`#a3342c`, que se agrega a los tokens como `--color-paper-error`).
  La nota judicial va al pie de la hoja. El foco visible dentro de la hoja usa
  `--color-primary-700`.
- [ ] **Step 4: Verificador:** los pasos como secuencia con conector (los mismos estilos de
  la línea de tiempo).
- [ ] **Step 5: Preguntas:** retícula de dos columnas, con el encabezado
  `position: sticky; top: calc(var(--header-height) + 32px)` en escritorio.
- [ ] **Step 6: Cierre:** título en `--font-display` y un foco radial más intenso detrás.
  **Fondo:** en `HomePage.module.css`, redistribuir los focos (uno por sección, el más
  intenso detrás de § 03).
- [ ] **Step 7:** Verificación completa en verde.
- [ ] **Step 8:** Commit `feat(frontend): componer las secciones de la landing como un expediente`.

### Task 8: Revisión en el navegador, ADR y PR

**Files:**
- Create: `docs/adr/adr-0NN.md` (el número siguiente libre en `origin/develop`; hoy, 041)

- [ ] **Step 1:** A 1440 × 900 y a 375 px: capturas de cada sección. Saltar con
  `scrollTo` a 3000 px y a 6000 px y capturar de inmediato: sin zonas vacías. Comprobar
  `document.documentElement.scrollWidth <= innerWidth` a 375 px.
- [ ] **Step 2:** Medir el contraste del papel (`--color-paper-ink` y `--color-paper-muted`
  sobre `--color-paper`) y anotar las cifras.
- [ ] **Step 3:** Emular `prefers-reduced-motion` y confirmar que no hay movimiento y que
  todo se ve.
- [ ] **Step 4:** Escribir el ADR en el formato de tabla de ADR-023: la fuente y su peso en
  kB (de la salida del build), la hoja de papel con su contraste, el `Reveal` ligado al
  desplazamiento y el presupuesto de movimiento. Commit
  `docs(docs): registrar el rediseño de la landing (ADR-0NN)`.
- [ ] **Step 5:** Verificación completa en verde, `git push -u origin HEAD` y PR contra
  `develop` con el resumen, las capturas descritas y las pruebas.
