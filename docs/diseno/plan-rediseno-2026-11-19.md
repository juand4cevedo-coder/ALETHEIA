# Plan de implementación del rediseño visual

> **Para quien lo ejecute:** este plan se implementa tarea por tarea, en orden. Los pasos usan casillas (`- [ ]`) para llevar el control.

**Objetivo:** reemplazar la piel completa de ALETHEIA por el sistema de marfil y tinta del diseño aprobado, con celular primero, sin agregar peso ni dependencias de movimiento.

**Arquitectura:** capa nueva de primitivas y migración pantalla por pantalla. Se construyen tokens, tipografía y componentes base nuevos; luego se migra en orden aplicación, portada, acceso y contenido. Cada componente viejo se elimina cuando su última pantalla lo suelta. No se toca lógica de negocio, rutas ni el cliente generado del API.

**Tecnologías:** React 19, TypeScript, Vite 8, CSS Modules, Vitest con jsdom, axe-core. Sin librerías de animación.

**Especificación:** `docs/diseno/rediseno-2026-11-19.md`. El plan argumenta desde ahí; quien ejecute lee los dos.

## Restricciones globales

Las requiere toda tarea, aunque no se repitan en ella.

- JavaScript inicial menor a 120.000 bytes comprimidos. El límite no se mueve.
- CSS inicial menor a 36.000 bytes comprimidos. Hoy el script fija 30.000 y la tarea 1 lo cambia.
- **El gestor de paquetes es pnpm 12, no npm.** `frontend/pnpm-lock.yaml` es el archivo de bloqueo versionado y `frontend/pnpm-workspace.yaml` lleva las excepciones de auditoría. Se instala con `pnpm install --frozen-lockfile`, se agrega con `pnpm add` y se ejecuta todo con `pnpm`. Un `npm install` genera un `package-lock.json` espurio y resuelve versiones por su cuenta, ignorando el bloqueo: si aparece ese archivo, se borra.
- **Los argumentos de las pruebas van sin `--`.** `pnpm test -- src/algo.test.ts` reenvía el guion doble a vitest, que entonces ignora en silencio tanto el filtro de archivo como el de nombre y corre la suite completa. Comprobado: con `--` corren los 48 archivos; sin `--` corre solo el pedido. La forma correcta es `pnpm test src/algo.test.ts --testNamePattern "patron"`.
- **Toda fotografía necesita `height: auto` en su CSS.** El componente `Foto` emite `width` y `height` reales para que el navegador reserve el espacio y no haya salto de maquetación. Si el CSS del consumidor fija el ancho sin soltar el alto, esos mismos atributos deforman la imagen. Las tareas 13, 14 y 15, que son las que la usan, declaran `height: auto` junto a cualquier `width` que le pongan. Ninguna prueba de `Foto` puede ver esto: vive en el CSS de quien la consume.
- Las 352 pruebas de interfaz, en 48 archivos, siguen pasando. Se ejecutan con `pnpm test` desde `frontend/`. Esa es la línea base medida el 19 de noviembre en este worktree; la cifra de 295 que citan los documentos anteriores quedó desactualizada.
- **Única excepción, declarada aquí para que nadie la trate como defecto:** la prueba `tokens retirados` de `src/styles/tokens.test.ts` queda en rojo desde la tarea 1 hasta la tarea 10. Es intencional: esa prueba es el inventario de archivos que todavía usan los nombres viejos, y va bajando a medida que se migra. La tarea 10 exige verla en verde. Entre tanto, las tareas se verifican con `pnpm test --testNamePattern "^(?!tokens retirados)"`. Ninguna otra prueba puede estar roja en ningún momento.
- **Las pruebas no pueden medir maquetación.** Las pruebas corren en jsdom, que no calcula layout: `getComputedStyle` sobre clases de CSS Modules devuelve vacío y `scrollWidth` devuelve cero. Lo que se verifica sobre el estilo se hace leyendo el archivo CSS del disco, como ya lo hace `src/styles/tokens.test.ts`. Lo que de verdad necesita un navegador se verifica a mano en la tarea 17.
- Sin violaciones de axe en las pantallas que ya tienen esa prueba.
- Una sola dependencia nueva: `@fontsource-variable/fraunces` fijada en `5.3.0`. Sale `@fontsource/instrument-serif`.
- Solo se animan `transform` y `opacity`. Nada de librerías de desplazamiento.
- Hoja de estilo con consultas `min-width`. Base 360 px; cortes en 600, 900 y 1200 px.
- Ningún objetivo táctil por debajo de 44 px.
- **Ningún campo de formulario con fuente menor a 16 px.** La regla es acotada y conviene no generalizarla: los navegadores móviles acercan la pantalla cuando alguien enfoca un `input`, un `select` o un `textarea` con fuente menor a 16 px, y el usuario queda con la página ampliada sin haberlo pedido. No aplica a enlaces, botones ni etiquetas, que viven cómodos en los 15 px de `--font-size-ui`. Forzar 16 px en toda la interfaz la engordaría sin ganar nada.
- Español de Colombia, tratamiento de usted, en interfaz, comentarios, documentos y mensajes de commit.
- `src/content/redaccion.test.ts` valida la redacción. Todo texto nuevo pasa por ahí.

## Foco de revisión

Cinco maneras de romperse que la especificación implica y que ninguna tarea probaría por su cuenta. Cada una tiene abajo la prueba que la fija, dentro de la tarea dueña del código.

1. **El revelado deja el contenido invisible.** Si el elemento arranca en `opacity: 0` y `IntersectionObserver` no corre, por una excepción o por un navegador sin soporte, la página queda en blanco con el texto presente en el DOM. Es el riesgo más caro del plan. Prueba en la tarea 3.
2. **Sin soporte de `animation-timeline`.** El paralaje debe degradar a composición estática y legible, nunca a una imagen desplazada fuera de su marco. Prueba en la tarea 3.
3. **La fotografía no carga.** Las dos secciones de tinta ponen texto claro sobre foto; si la imagen falla, el fondo debe seguir siendo tinta y no papel, o el texto desaparece. Prueba en la tarea 13.
4. **Texto largo en 360 px.** Nombres de caso, de organización y correos largos desbordan la tarjeta en el ancho base. Prueba en la tarea 8.
5. **Zoom al 200 por ciento.** El titular con `clamp()` y las tablas convertidas en tarjetas deben seguir sin desplazamiento horizontal. Prueba en la tarea 10.

---

## Fase 1: fundaciones

### Task 1: Tokens del sistema nuevo

**Archivos:**
- Modificar: `frontend/src/styles/tokens.css`
- Modificar: `frontend/src/styles/tokens.test.ts`
- Modificar: `frontend/scripts/check-bundle-budget.mjs:34`

**Interfaces:**
- Produce: los nombres de token de la sección 7.1 de la especificación, más `--radius-sm` 4px, `--radius-md` 8px, `--radius-lg` 14px. Todas las tareas siguientes los consumen.

- [ ] **Paso 1: reescribir la prueba de identidad**

En `tokens.test.ts`, reemplazar `SEMANTIC_COLORS` por los dieciséis valores de la sección 7.1, y cambiar las superficies de `legibilidad de la identidad` de `["--bg", "--surface-1", "--surface-2"]` a `["--paper", "--paper-raised", "--paper-sunken"]`. Sustituir el bloque `mantiene contraste en botones y superficies oscuras` por:

```ts
it("mantiene contraste sobre las superficies de tinta", () => {
  for (const surface of ["--ink-900", "--ink-700"]) {
    expect(contrast("--on-ink", surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--on-ink-2", surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--brass-400", surface)).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast("--paper", "--ink-900")).toBeGreaterThanOrEqual(4.5);
});
```

Agregar al final de `RETIRED_TOKENS` los nombres que salen: `--gold`, `--gold-hover`, `--brand-dark`, `--brand-muted`, `--brand-line`, `--bronze`, `--on-brand`, `--surface-0`, `--surface-1b`, `--accent-nav`, `--tint-integridad`, `--tint-seguridad`, `--line-accent`.

- [ ] **Paso 2: correr la prueba y verificar que falla**

Ejecutar: `pnpm test src/styles/tokens.test.ts` desde `frontend/`
Esperado: FALLA, porque `tokens.css` todavía declara los valores viejos.

- [ ] **Paso 3: reescribir `tokens.css`**

Declarar los dieciséis colores semánticos, los tres radios, la escala tipográfica fluida de la sección 7.2 con `clamp()`, las duraciones de la sección 7.4 y las sombras de dos capas con tinte de tinta. Quitar `color-scheme: dark` de `:root`. Conservar la escala de espacio de 4 px, `--touch-target`, `--content-width` y `--measure`, que no cambian. El bloque `@media print` se reduce a lo que siga siendo necesario con base de papel.

La prueba de tokens retirados falla mientras otros archivos usen los nombres viejos. Es lo esperado: vuelve a verde al terminar la fase 2, y hasta entonces se corre con `--testNamePattern` para excluirla.

- [ ] **Paso 4: subir el techo de CSS**

En `check-bundle-budget.mjs:34`, cambiar `30_000` por `36_000`. En el comentario de la línea 4, anotar que el techo subió con el rediseño del 19 de noviembre.

- [ ] **Paso 5: verificar**

Ejecutar: `pnpm test src/styles/tokens.test.ts --testNamePattern "^(?!tokens retirados)"`
Esperado: PASAN las pruebas de valores y de contraste.

- [ ] **Paso 6: commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/styles/tokens.test.ts frontend/scripts/check-bundle-budget.mjs
git commit -m "diseno: establecer la paleta de marfil y tinta"
```

### Task 2: Tipografía

**Archivos:**
- Modificar: `frontend/package.json`
- Modificar: `frontend/src/styles/fonts.css`
- Modificar: `frontend/index.html:18-24`

**Interfaces:**
- Produce: las familias `"Fraunces Variable"` en `--font-editorial` y `"Inter Variable"` en `--font-sans`. `--font-mono` no cambia.

- [ ] **Paso 1: instalar y retirar**

`pnpm add @fontsource-variable/fraunces@5.3.0 && pnpm remove @fontsource/instrument-serif` desde `frontend/`.

- [ ] **Paso 2: elegir el archivo por eje**

No se genera ningún subconjunto. Fontsource publica una compilación por eje: `standard`, `wght`, `opsz`, `soft`, `wonk` y `full`, cada una con su recorte de alfabeto. Se usa `files/fraunces-latin-opsz-normal.woff2`, de 67 KB, que lleva tamaño óptico y peso y **no** lleva SOFT ni WONK, los dos ejes caprichosos que no van con el tono del producto. Al venir en compilaciones separadas, no hay nada que fijar en cero.

Esto evita meter una herramienta de tipografía al proyecto y sigue el camino que ya usan las otras tres fuentes, que apuntan a los archivos de Fontsource resueltos desde `node_modules`. No se crea `public/fonts/` ni queda comando que documentar.

- [ ] **Paso 3: declarar las fuentes**

En `fonts.css`, reemplazar las tres declaraciones de Instrument Serif por una sola de `"Fraunces Variable"` con `font-weight: 100 900` y `src` apuntando a `@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2`, igual que la de Inter. Conservar Inter y Geist Mono tal como están.

- [ ] **Paso 4: precargar**

En `index.html`, agregar un segundo `<link rel="preload">` para la fuente editorial, junto al de Inter. Cambiar `theme-color` de `#000000` a `#F4F1EA`.

- [ ] **Paso 5: verificar**

Ejecutar: `pnpm run build` desde `frontend/`
Esperado: compila y el presupuesto reporta ambas entradas bajo su límite.

- [ ] **Paso 6: commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/styles/fonts.css frontend/index.html
git commit -m "diseno: adoptar Fraunces como tipografia editorial"
```

### Task 3: Primitivas de superficie y movimiento

**Archivos:**
- Crear: `frontend/src/components/ui/Reveal.tsx`
- Crear: `frontend/src/components/ui/Reveal.module.css`
- Crear: `frontend/src/components/ui/Reveal.test.tsx`
- Modificar: `frontend/src/styles/global.css`

**Interfaces:**
- Produce: `Reveal({ children, delay }: { children: ReactNode; delay?: number })`, que envuelve contenido y lo revela al entrar en pantalla. `delay` en milisegundos, por omisión 0.
- Produce: la clase utilitaria `.parallax` en `global.css`, que aplica `animation-timeline: view()` dentro de `@supports (animation-timeline: view())`.

- [ ] **Paso 1: escribir las pruebas que fallan**

En `Reveal.test.tsx`:

```tsx
it("muestra su contenido cuando el navegador no tiene IntersectionObserver", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  render(<Reveal>texto</Reveal>);
  expect(screen.getByText("texto")).toBeVisible();
});

it("marca el contenido como visible al entrar en pantalla", () => {
  // Observer simulado que dispara isIntersecting: true.
  render(<Reveal>texto</Reveal>);
  expect(screen.getByText("texto").parentElement).toHaveAttribute("data-visible", "true");
});

it("no vuelve a ocultar el contenido al salir de pantalla", () => {
  // Dispara isIntersecting: true y luego false.
  expect(screen.getByText("texto").parentElement).toHaveAttribute("data-visible", "true");
});
```

Estas tres cubren el punto 1 del foco de revisión.

- [ ] **Paso 2: correr y verificar que fallan**

Ejecutar: `pnpm test src/components/ui/Reveal.test.tsx`
Esperado: FALLA con módulo no encontrado.

- [ ] **Paso 3: implementar `Reveal`**

El estado inicial es visible y el componente solo oculta si `IntersectionObserver` existe, nunca al revés. Es la diferencia entre degradar a contenido visible y degradar a página en blanco. El observador se desconecta después del primer cruce.

- [ ] **Paso 4: mover el revelado a `global.css`**

Reemplazar el bloque `[data-reveal-ready]` actual por reglas sobre `[data-visible]`, con la duración y la curva de la sección 7.4. Agregar `.parallax` dentro de `@supports`, de modo que sin soporte el elemento quede estático en su posición natural. Esto cubre el punto 2 del foco de revisión. Quitar `color-scheme` si quedara alguna referencia.

- [ ] **Paso 5: verificar**

Ejecutar: `pnpm test src/components/ui/Reveal.test.tsx`
Esperado: PASAN las tres.

- [ ] **Paso 6: commit**

```bash
git add frontend/src/components/ui/Reveal.tsx frontend/src/components/ui/Reveal.module.css frontend/src/components/ui/Reveal.test.tsx frontend/src/styles/global.css
git commit -m "diseno: agregar el revelado por entrada en pantalla"
```

### Task 4: Botones y campos

**Archivos:**
- Modificar: `frontend/src/components/ui/Button.module.css`
- Modificar: `frontend/src/components/ui/buttonStyles.ts`
- Modificar: `frontend/src/components/ui/Field.module.css`
- Modificar: `frontend/src/components/ui/Checkbox.module.css`
- Modificar: `frontend/src/components/ui/Select.module.css`

**Interfaces:**
- Produce: `ButtonVariant` pasa de `"primary" | "secondary" | "text"` a `"primary" | "secondary" | "text" | "circular"`. Las tres primeras conservan su nombre, así que ninguna pantalla existente se rompe.

- [ ] **Paso 1: reescribir `Button.module.css`**

Las cuatro variantes de la sección 8.1 con sus valores. Eliminar el degradado del botón principal y las dos reglas `.secondary` duplicadas del final del archivo, que hoy sobrescriben a las de arriba. Altura 52 px, radio 4 px, transición de 180 ms.

- [ ] **Paso 2: agregar la variante circular**

En `buttonStyles.ts`, extender el tipo y mapear `"circular"` a la clase nueva. La función `buttonClassName` conserva su firma.

- [ ] **Paso 3: reescribir los estilos de los controles de formulario**

`Field.module.css`, `Checkbox.module.css` y `Select.module.css` con los valores de la sección 8.2. El componente `Field.tsx` no se toca: ya pone la etiqueta encima y asocia ayuda y error con `aria-describedby`. Solo cambia su piel.

- [ ] **Paso 4: verificar**

Ejecutar: `pnpm test src/components/ui`
Esperado: PASAN, incluidas las instantáneas de iconos.

- [ ] **Paso 5: commit**

```bash
git add frontend/src/components/ui
git commit -m "diseno: rehacer botones y controles de formulario"
```

### Task 5: Marca

**Archivos:**
- Modificar: `frontend/src/assets/simbolo.svg`, `frontend/public/favicon.svg`, `frontend/public/favicon.png`, `frontend/public/apple-touch-icon.png`, `frontend/public/og-image.png`, `frontend/public/site.webmanifest`, `frontend/public/email/logo-claro.png`, `frontend/public/brand/`
- Modificar: `frontend/src/components/ui/icons/fabrica.tsx`
- Modificar: `docs/diseno/og-image.svg`

- [ ] **Paso 1: ajustar el trazo de los iconos**

En `fabrica.tsx`, cambiar el ancho de trazo de 1,5 a 1,25 y las terminaciones a rectas. Los cincuenta iconos heredan el cambio.

- [ ] **Paso 2: actualizar las instantáneas**

Ejecutar: `pnpm test src/components/ui/icons.test.tsx -u`
Revisar el diff de `__snapshots__/icons.test.tsx.snap` antes de aceptarlo.

- [ ] **Paso 3: rehacer los archivos de marca**

Favicon SVG con `prefers-color-scheme`, PNG de 32 px, icono de dispositivo de 180 px sobre tinta, imagen social de 1200 por 630 px con la paleta nueva, y los dos símbolos de `public/brand/`. En `site.webmanifest`, cambiar los colores de fondo y de tema a los nuevos.

- [ ] **Paso 4: agregar el icono de flecha circular**

Crear `frontend/src/components/ui/icons/FlechaCircular.ts` siguiendo el formato de los otros cincuenta y exportarlo desde `icons.tsx`.

- [ ] **Paso 5: verificar y commit**

```bash
pnpm test src/components/ui/icons.test.tsx
git add frontend/src/assets frontend/public frontend/src/components/ui/icons docs/diseno/og-image.svg
git commit -m "diseno: renovar los recursos de marca y afinar el trazo de los iconos"
```

### Task 6: Banco de fotografías

**Archivos:**
- Crear: `frontend/public/media/` con los derivados de cada fotografía
- Crear: `frontend/src/components/ui/Foto.tsx`, `Foto.test.tsx`

**Interfaces:**
- Produce: `Foto({ nombre, alt, prioridad }: { nombre: string; alt: string; prioridad?: boolean })`, un `img` con `srcset` a 400, 800, 1200 y 1600 px armado desde el nombre base, con `sizes`, `width`, `height` y `decoding="async"`. Con `prioridad`, emite `fetchpriority="high"` y omite `loading="lazy"`; sin ella, al revés. Lo consumen las tareas 13, 14 y 15.

Las fotografías son cuatro: la de la sección de seguridad, la del cierre, la del footer y la del acceso.

**División del trabajo.** Las fotografías y sus derivados los consigue y genera el controlador, por la misma razón que las imágenes de marca: el proyecto no tiene herramienta de imagen y no se le agrega una. Cuando esta tarea se implemente, los dieciséis archivos ya estarán en `public/media/`. Quien implemente construye el componente y sus pruebas, y no toca `public/media/`.

**Solo WebP, sin AVIF.** La especificación lo explica en 7.5: el navegador, que es con lo que se generan los derivados, no codifica AVIF y además falla en silencio devolviendo un PNG renombrado. Una sola fuente por imagen significa que el componente es un `img` con `srcset`, sin `picture` ni `source`.

- [ ] **Paso 1: escribir la prueba que falla**

```tsx
it("declara dimensiones para que no haya salto de maquetacion", () => {
  render(<Foto nombre="seguridad" alt="Archivo" />);
  const img = screen.getByAltText("Archivo");
  expect(img).toHaveAttribute("width");
  expect(img).toHaveAttribute("height");
});

it("difiere la carga salvo cuando es prioritaria", () => {
  expect(screen.getByAltText("Archivo")).toHaveAttribute("loading", "lazy");
});
```

- [ ] **Paso 2: correr y verificar que falla**

Ejecutar: `pnpm test src/components/ui/Foto.test.tsx`

- [ ] **Paso 3: implementar `Foto`**

Un `img`, no un `picture`. El `srcset` se arma desde el nombre base y los cuatro anchos; `sizes` lo recibe por prop con un valor por omisión de `100vw`.

- [ ] **Paso 4: escribir la prueba de los archivos que existen**

La trampa de un `srcset` armado por concatenación es que apunte a archivos que no están: el navegador no avisa, simplemente no pinta. Una prueba lee el directorio `public/media/` y verifica que, para cada nombre que el producto consume, existan los cuatro anchos.

```tsx
it.each(["seguridad", "cierre", "pie", "acceso"])(
  "%s tiene sus cuatro anchos en public/media",
  (nombre) => {
    for (const ancho of [400, 800, 1200, 1600]) {
      expect(existsSync(join(MEDIA, `${nombre}-${ancho}.webp`))).toBe(true);
    }
  },
);
```

- [ ] **Paso 5: verificar y commit**

```bash
pnpm test src/components/ui/Foto.test.tsx
git add frontend/src/components/ui/Foto.tsx frontend/src/components/ui/Foto.test.tsx
git commit -m "diseno: incorporar el componente de fotografia"
```

---

## Fase 2: aplicación

### Task 7: Armazón de la aplicación

**Archivos:**
- Modificar: `frontend/src/layouts/AppShell.module.css`, `frontend/src/features/workspace/WorkspaceNav.module.css`, `frontend/src/features/session/AccountMenu.module.css`
- Modificar: `frontend/src/layouts/AppShell.test.tsx`

- [ ] **Paso 1: reescribir los tres módulos con el sistema nuevo**

Barra lateral sobre `--paper-sunken`, contenido sobre `--paper`, franja del ítem activo en `--brass-600`. Consultas `min-width`: la barra lateral aparece desde 900 px; debajo es el diálogo que ya existe.

- [ ] **Paso 2: verificar**

Ejecutar: `pnpm test src/layouts/AppShell.test.tsx`
Esperado: PASA, incluida su comprobación de axe.

- [ ] **Paso 3: commit**

```bash
git add frontend/src/layouts frontend/src/features/workspace frontend/src/features/session
git commit -m "diseno: migrar el armazon del espacio de trabajo"
```

### Task 8: Pantallas de casos

**Archivos:**
- Modificar: `frontend/src/pages/CasesPage.module.css`, `CasePage.module.css`, `NewCasePage.module.css`, `EvidenceDetailPage.module.css`
- Modificar: `frontend/src/features/cases/*.module.css`
- Modificar: `frontend/src/pages/CasesPage.test.tsx`

- [ ] **Paso 1: escribir la prueba de texto largo**

En `CasesPage.test.tsx`:

```tsx
const css = readFileSync(join(import.meta.dirname, "CasesPage.module.css"), "utf8");

it("permite cortar nombres largos para que no desborden", () => {
  expect(css).toMatch(/overflow-wrap:\s*anywhere/);
});

it("rinde un nombre de 120 caracteres sin espacios", () => {
  // El caso de prueba lleva ese nombre; basta con que la pantalla renderice.
  expect(screen.getByText(/^x{120}$/)).toBeInTheDocument();
});
```

Cubre el punto 4 del foco de revisión. La primera prueba lee el CSS del disco porque jsdom no aplica CSS Modules; la segunda confirma que el dato largo no rompe el renderizado.

- [ ] **Paso 2: correr y verificar que falla**

Ejecutar: `pnpm test src/pages/CasesPage.test.tsx`
Esperado: FALLA.

- [ ] **Paso 3: migrar los módulos**

Tarjetas sobre `--paper-raised` con filete metálico superior y sombra de dos capas. Por debajo de 600 px la lista de casos es una lista de tarjetas, no una tabla. Aplicar `overflow-wrap: anywhere` a los nombres.

- [ ] **Paso 4: verificar**

Ejecutar: `pnpm test src/pages/CasesPage.test.tsx src/pages/CasePage.test.tsx src/pages/EvidenceDetailPage.test.tsx src/pages/NewCasePage.test.tsx`
Esperado: PASAN.

- [ ] **Paso 5: commit**

```bash
git add frontend/src/pages frontend/src/features/cases
git commit -m "diseno: migrar las pantallas de casos y evidencia"
```

### Task 9: Pantallas de organización y cuenta

**Archivos:**
- Modificar: `frontend/src/pages/MembersPage.module.css`, `OrganizationPage.module.css`, `OrganizationAuditPage.module.css`, `AccountPage.module.css`, `SupportPage.module.css`, `ExportDownloadPage.module.css`, `WorkspacePage.module.css`
- Modificar: `frontend/src/features/members/InviteDialog.module.css`, `frontend/src/components/ui/Dialog.module.css`
- Modificar: `frontend/src/components/ui/StatTile.module.css`, `frontend/src/components/ui/Hash.module.css`

**Dos defectos heredados que esta tarea cierra.** Los dos se encontraron midiendo en el navegador, no leyendo código, y los dos viven en componentes compartidos que ninguna tarea anterior tenía asignados.

- **`StatTile` parte palabras a la mitad.** Sus valores se leen como "No dispo / nible" en anchos estrechos. Un número partido en dos renglones deja de ser un número. La causa habitual es un corte de palabra permisivo heredado; la cifra debe mantenerse entera y, si no cabe, reducir su tamaño antes que romperla.
- **El botón "Copiar huella" de `Hash` mide 82 por 21 px.** Está por debajo del mínimo táctil de 44 px de alto. Es el único objetivo táctil insuficiente que quedó en las pantallas de casos.
- **`AccountMenu.module.css` repite el literal del filete** en dos líneas. La tarea 8 creó `--ink-hairline` para eso y reemplazó las veintiuna ocurrencias de sus archivos; estas dos quedaron fuera porque el archivo pertenece a la tarea 7, ya cerrada. Reemplácelas por el token.

- [ ] **Paso 1: migrar los módulos**

Mismo tratamiento de tarjeta que la tarea 8. Los diálogos sobre `--paper-raised` con sombra flotante. Las tablas de miembros y de auditoría pasan a lista de tarjetas bajo 600 px.

- [ ] **Paso 2: verificar**

Ejecutar: `pnpm test src/pages`
Esperado: PASAN.

- [ ] **Paso 3: commit**

```bash
git add frontend/src/pages frontend/src/features/members frontend/src/components/ui/Dialog.module.css
git commit -m "diseno: migrar organizacion, miembros y cuenta"
```

### Task 10: Consola de plataforma

**Archivos:**
- Modificar: `frontend/src/pages/PlatformPage.module.css`, `PlatformModulesPage.tsx`
- Modificar: `frontend/src/pages/PlatformPage.test.tsx`
- Modificar: `frontend/src/components/ui/FilingNumber.module.css`

**El último componente compartido sin migrar.** `FilingNumber` dibuja el número de radicado y lo usan cuatro pantallas de casos. Quedó fuera de las tareas 8 y 9 porque ninguna lo tenía en su lista, y es el último que sigue leyendo tokens retirados. Con él, el inventario queda en cero.

`Tabs` también los usa y **no se migra**: nadie lo importa y la tarea 17 lo elimina. Migrar un módulo muerto es trabajo que se borra una semana después.

**Esta tarea cierra la migración de la aplicación, no el inventario.** Conviene corregir aquí un error del plan: una versión anterior afirmaba que la prueba `tokens retirados` pasaría al terminar esta tarea. No puede. El inventario cubre todo `src/`, y la aplicación es solo una parte del producto: al cerrar esta tarea quedan 35 archivos, todos del sitio público, que pertenecen a las tareas 12 a 16.

El calendario real del inventario es este:

| Hito | Qué queda en la lista |
| --- | --- |
| Fin de la tarea 10 | 35 archivos: portada, acceso, legales, pagos, cubiertas públicas y `Tabs` |
| Fin de la tarea 16 | 1 archivo: `Tabs`, que es código muerto |
| Fin de la tarea 17 | Ninguno. La tarea 17 elimina `Tabs` y la prueba pasa |

Hasta la tarea 17, las tareas siguen verificando con `pnpm test --testNamePattern "^(?!tokens retirados)"`.

- [ ] **Paso 1: escribir la prueba de anchos fijos**

```tsx
const css = readFileSync(join(import.meta.dirname, "PlatformPage.module.css"), "utf8");
const base = css.split("@media")[0]!;

it("no declara anchos fijos mayores al ancho base fuera de una consulta de medio", () => {
  const anchos = [...base.matchAll(/\bwidth:\s*(\d+)px/g)].map((m) => Number(m[1]));
  expect(anchos.filter((valor) => valor > 360)).toEqual([]);
});
```

Cubre el punto 5 del foco de revisión en lo que una prueba puede cubrir: un ancho fijo mayor al ancho base, declarado fuera de una consulta `min-width`, es la causa más común de desplazamiento horizontal. El desplazamiento real y el zoom al 200 por ciento se verifican en el navegador en la tarea 17.

- [ ] **Paso 2: correr y verificar que falla**

Ejecutar: `pnpm test src/pages/PlatformPage.test.tsx`

- [ ] **Paso 3: migrar las cuatro pantallas**

Quitar `color-scheme: dark` de `PlatformPage.module.css:167`. Es la última declaración local de tema oscuro que queda en el proyecto.

- [ ] **Paso 4: verificar que la prueba de tokens retirados ya pasa**

Ejecutar: `pnpm test src/styles/tokens.test.ts`
Esperado: PASAN todas, incluida `tokens retirados`, porque ningún archivo de `src` usa ya los nombres viejos. Si alguna falla, nombra el archivo que falta migrar.

- [ ] **Paso 5: commit**

```bash
git add frontend/src/pages
git commit -m "diseno: migrar la consola de plataforma y retirar el tema oscuro"
```

### Task 11: Recaptura de las imágenes del producto

**Archivos:**
- Modificar: `frontend/public/media/producto-resumen.webp`, `producto-casos.webp`, `producto-actividad.webp`

- [ ] **Paso 1: capturar con el diseño nuevo**

Levantar la aplicación con datos locales de revisión y capturar las tres vistas que el texto alternativo de `ProductTour.tsx:119` describe: resumen con tres casos abiertos, lista de casos y actividad. Sin datos de clientes.

- [ ] **Paso 2: verificar que el texto alternativo sigue siendo cierto**

Leer los tres textos alternativos y confirmar que describen lo que ahora muestra cada imagen. Si cambió el conteo de casos, corregir el texto y volver a correr `pnpm test src/content/redaccion.test.ts`.

- [ ] **Paso 3: commit**

```bash
git add frontend/public/media
git commit -m "diseno: recapturar las imagenes del recorrido con la interfaz nueva"
```

---

## Fase 3: portada, navegación y footer

### Task 12: Hero y escena documental

**Archivos:**
- Modificar: `frontend/src/features/landing/Hero.module.css`, `DocumentScene.module.css`, `StampCard.module.css`
- Modificar: `frontend/src/features/landing/Hero.tsx`, `DocumentScene.tsx`

**La escena deja de usar el sello como pieza central.** `DocumentScene.tsx:24` dibuja `SelloIcon` a 64 px en el centro del hero. Ese sello dentado con manecillas era la marca anterior, la que se descartó. Dejarlo ahí significa abrir la portada con un símbolo abandonado, compitiendo con la marca nueva que está a pocos centímetros en el encabezado. Se reemplaza por una pieza que pertenezca a la escena, no por el símbolo de marca: la marca vive en el encabezado y en el pie, y repetirla en el hero la abarata.

`SelloIcon` se conserva como icono de interfaz en `StampCard` y en `WorkspacePage`, donde a 16 px significa evidencia sellada y no pretende ser la marca.

- [ ] **Paso 1: escribir la prueba del titular visible**

El titular del hero está hoy **completamente invisible**, y la causa merece atención porque es la misma familia de fallo que el revelado: `Hero.module.css:70` recorta un degradado contra el texto con `background-clip: text` y deja el relleno transparente. El degradado se construía con tokens retirados, así que ahora resuelve a `none` y el texto queda en transparente sobre papel. Comprobado en el navegador: el titular computa `-webkit-text-fill-color: rgba(0, 0, 0, 0)` y `background-image: none`.

La misma técnica aparece en `pages/EditorialPage.module.css:222`, que pertenece a la tarea 16. Las dos deben quedar cubiertas.

En `src/features/landing/BelowFold.test.tsx`:

```tsx
it.each(["features/landing/Hero", "pages/EditorialPage"])(
  "%s nunca deja el texto sin relleno visible",
  (ruta) => {
    const css = readFileSync(join(SRC, `${ruta}.module.css`), "utf8");
    // Si se recorta un degradado contra el texto, tiene que haber un degradado.
    if (/background-clip:\s*text/.test(css)) {
      expect(css).toMatch(/background-image:\s*linear-gradient/);
    }
  },
);
```

- [ ] **Paso 2: correr y verificar que falla**

Ejecutar: `pnpm test src/features/landing/BelowFold.test.tsx`

- [ ] **Paso 3: migrar el hero**

Titular en `--font-editorial` con la escala de display. La escena documental conserva su geometría y su movimiento; solo cambia su paleta. El hero no lleva fotografía de fondo. Si el degradado sobre el titular no aporta al diseño nuevo, la salida preferible es retirar el recorte y usar color sólido: un titular sólido nunca puede volverse invisible.

- [ ] **Paso 4: verificar y commit**

```bash
pnpm test src/features/landing
git add frontend/src/features/landing
git commit -m "diseno: migrar el hero y la escena documental"
```

### Task 13: Secciones de la portada

**Archivos:**
- Modificar: los nueve módulos de `frontend/src/features/landing/`
- Modificar: `frontend/src/features/landing/BelowFold.tsx`

- [ ] **Paso 1: escribir la prueba de respaldo de las secciones de tinta**

En `src/features/landing/BelowFold.test.tsx`, para cada uno de los dos módulos que van sobre tinta:

```tsx
it.each(["StandardsSection", "ClosingSection"])(
  "%s declara color de fondo propio, no solo la imagen",
  (nombre) => {
    const css = readFileSync(join(import.meta.dirname, `${nombre}.module.css`), "utf8");
    expect(css).toMatch(/background-color:\s*var\(--ink-900\)/);
  },
);
```

Cubre el punto 3 del foco de revisión: el color de tinta va en `background-color` y la foto en `background-image`, nunca al revés. Si la fotografía no carga, el texto claro conserva su fondo oscuro.

- [ ] **Paso 2: correr y verificar que falla**

Ejecutar: `pnpm test src/features/landing/BelowFold.test.tsx`

- [ ] **Paso 3: aplicar la alternancia de la sección 7.8**

Cada sección recibe la superficie que le asigna la tabla. Seguridad y Cierre van a sangre completa sobre tinta con fotografía; las demás sobre papel. Envolver los bloques en `Reveal` con escalonado de 60 ms.

- [ ] **Paso 4: aplicar el paralaje al recorrido**

Las tres columnas de imágenes usan la clase `.parallax` de la tarea 3.

- [ ] **Paso 5: verificar**

Ejecutar: `pnpm test src/features/landing src/pages/HomePage.test.tsx`
Esperado: PASAN.

- [ ] **Paso 6: commit**

```bash
git add frontend/src/features/landing
git commit -m "diseno: componer la portada con alternancia de papel y tinta"
```

### Task 14: Navegación, footer y panel de cookies

**Archivos:**
- Modificar: `frontend/src/layouts/PublicLayout.module.css`, `PublicNavigation.module.css`
- Modificar: `frontend/src/features/consent/CookiePanel.module.css`, `CookiePanel.tsx`
- Modificar: `frontend/src/features/consent/CookiePanel.test.tsx`

- [ ] **Paso 1: escribir la prueba del panel de cookies**

```tsx
it("declara su altura en una variable para que nada quede tapado", () => {
  render(<CookiePanel />);
  expect(document.documentElement.style.getPropertyValue("--cookie-bar-height")).not.toBe("");
});
```

- [ ] **Paso 2: correr y verificar que falla**

Ejecutar: `pnpm test src/features/consent/CookiePanel.test.tsx`

- [ ] **Paso 3: convertir el panel en barra**

Barra compacta anclada abajo con `env(safe-area-inset-bottom)`, que publica su altura en la variable `--cookie-bar-height` sobre el elemento raíz. El hero y la pantalla de acceso reservan ese espacio con `padding-block-end: var(--cookie-bar-height, 0px)`. El valor de respaldo importa: las tareas 12 y 15 escriben esa regla antes de que esta tarea exista, y el respaldo las deja funcionando mientras tanto. Es el defecto de la sección 8.5.

- [ ] **Paso 4: migrar navegación y footer**

Footer con fotografía atmosférica que se disuelve hacia el papel, más aire vertical y el nombre en grande. Se conservan todos los enlaces legales, la configuración de cookies y el enlace a la autoridad de consumo.

- [ ] **Paso 5: verificar y commit**

```bash
pnpm test src/layouts src/features/consent
git add frontend/src/layouts frontend/src/features/consent
git commit -m "diseno: rehacer navegacion, footer y barra de cookies"
```

---

## Fase 4: acceso

### Task 15: Las seis pantallas de acceso

**Archivos:**
- Modificar: `frontend/src/features/auth/AccessScreen.module.css`, `AccountTypeChoice.module.css`, `PasswordMeter.module.css`, `SocialAccess.module.css`, `ResendVerification.module.css`
- Modificar: `frontend/src/layouts/AuthLayout.module.css`, `frontend/src/layouts/AuthLayout.tsx`

- [ ] **Paso 1: componer en dos columnas**

Desde 900 px, fotografía a sangre a la izquierda y formulario sobre papel a la derecha. En celular, una sola columna con banda de imagen corta arriba. `AccessScreen.module.css` lo heredan las cinco pantallas que lo importan.

- [ ] **Paso 2: bajar los proveedores inactivos**

En `SocialAccess`, mover los botones de Google y Microsoft debajo del formulario de correo. Conservar su texto que explica que todavía no están disponibles y su estado deshabilitado.

- [ ] **Paso 3: verificar**

Ejecutar: `pnpm test src/pages/SignInPage.test.tsx src/pages/SignUpPage.test.tsx src/pages/PasswordRecovery.test.tsx src/pages/AcceptInvitationPage.test.tsx src/pages/VerifyEmailPage.test.tsx src/features/auth`
Esperado: PASAN.

- [ ] **Paso 4: commit**

```bash
git add frontend/src/features/auth frontend/src/layouts/AuthLayout.module.css frontend/src/layouts/AuthLayout.tsx
git commit -m "diseno: rehacer las pantallas de acceso en dos columnas"
```

---

## Fase 5: contenido

### Task 16: Páginas legales, documentación y blog

**Archivos:**
- Modificar: `frontend/src/pages/LegalPage.module.css`, `DocumentationPage.module.css`, `EditorialPage.module.css`, `PricingPage.module.css`, `VerifierPage.module.css`, `NotFoundPage.module.css`, `CheckoutCard.module.css`
- Modificar: `frontend/src/features/legal/LegalRenewal.module.css`, `frontend/src/features/billing/PlanCard.module.css`, `PlanSummary.module.css`

- [ ] **Paso 1: migrar los módulos**

Medida de lectura entre 60 y 70 caracteres. El texto contractual de los documentos legales no se toca: solo su presentación.

- [ ] **Paso 2: verificar**

Ejecutar: `pnpm test`
Esperado: PASAN las 352.

- [ ] **Paso 3: commit**

```bash
git add frontend/src/pages frontend/src/features/legal frontend/src/features/billing
git commit -m "diseno: migrar legales, documentacion, blog y precios"
```

---

## Fase 6: limpieza

### Task 17: Retirar código muerto y verificar presupuesto

**Archivos:**
- Eliminar: `frontend/src/components/ui/Tabs.tsx`, `frontend/src/components/ui/Tabs.module.css`

- [ ] **Paso 1: eliminar el módulo muerto**

`Tabs.tsx` y su CSS no los importa nadie. Confirmar con `grep -rw Tabs frontend/src` antes de borrar.

**Con esa eliminación cierra el inventario.** `Tabs` es el último archivo de la lista de tokens retirados: nunca se migró porque migrar código muerto es trabajo que se borra. Al eliminarlo, `pnpm test src/styles/tokens.test.ts` pasa entero por primera vez desde la tarea 1, y desde ahí todas las verificaciones usan `pnpm test` a secas, sin patrón de exclusión. Si al borrarlo la prueba sigue roja, la lista nombra lo que falta y eso es parte de esta tarea.

- [ ] **Paso 2: buscar exportaciones sueltas**

Ejecutar `pnpm dlx knip --no-config-hints` desde `frontend/`. Revisar cada hallazgo a mano: eliminar lo que de verdad no se use y dejar lo que la herramienta no alcance a ver, como lo que consumen las pruebas. No se agrega `knip` a las dependencias del proyecto.

- [ ] **Paso 3: verificar el presupuesto y la accesibilidad**

Ejecutar: `pnpm run build && pnpm run lint && pnpm test`
Esperado: JavaScript bajo 120 kB, CSS bajo 36 kB, lint limpio, 352 pruebas en verde y sin violaciones de axe.

- [ ] **Paso 4: revisar a mano en el navegador**

Recorrer portada, acceso, casos y consola de plataforma a 360, 600, 900 y 1200 px, con movimiento normal y con movimiento reducido. En cada una, evaluar `document.documentElement.scrollWidth > window.innerWidth` en el navegador y confirmar que da falso. Repetir a 360 px con el zoom al 200 por ciento. Esto es lo que las pruebas no pueden cubrir, según las restricciones globales, y cierra los puntos 4 y 5 del foco de revisión.

Dos anchos merecen atención particular, porque quedaron sin medir en su momento:

- **Entre 901 y 1000 px**, donde la lista de casos vuelve a ser tabla pero el espacio disponible ronda los 565 px. Es el punto más apretado de esa pantalla y nadie lo ha mirado.
- **A 599 y 601 px**, a cada lado del corte donde las tablas de miembros y de auditoría cambian a lista de tarjetas. Los defectos de maquetación se esconden justo al lado de un corte, no en el centro de cada rango.

- [ ] **Paso 5: medir el costo de la precarga tipográfica**

`index.html` precarga el archivo de Fraunces, 67 KB, en todas las rutas. En la portada se justifica, porque el titular editorial es el elemento más grande de la primera pantalla y la precarga evita que aparezca primero en la fuente de respaldo. En las rutas de la aplicación, en cambio, la interfaz es Inter y el titular editorial casi no aparece, así que esos 67 KB podrían ser ancho de banda desperdiciado en la pantalla que más se visita.

Medir en el navegador, en una ruta de la aplicación: si la precarga no se aprovecha, el navegador deja el aviso de recurso precargado y no usado en la consola. Si aparece, la precarga pasa a ser condicional o se retira de esas rutas. Si no aparece, se deja como está y se anota la medición.

- [ ] **Paso 6: commit**

```bash
git add -A frontend
git commit -m "limpieza: retirar el modulo de pestanas sin uso y verificar presupuestos"
```

---

## Fase 7: documentación y correos

### Task 18: Plantillas de correo

**Archivos:**
- Modificar: las plantillas de correo del backend

- [ ] **Paso 1: localizar las plantillas**

`grep -rl "logo-claro\|<html" backend/app` para encontrarlas.

- [ ] **Paso 2: aplicar la paleta nueva**

Solo presentación: colores, tipografía de respaldo y el logo. No se toca lógica de envío, ni asuntos, ni variables de plantilla.

- [ ] **Paso 3: verificar**

Ejecutar las pruebas del backend que cubren correos y revisar uno en Mailpit, en `http://127.0.0.1:8025`.

- [ ] **Paso 4: commit**

```bash
git add backend/app
git commit -m "diseno: alinear las plantillas de correo con la identidad nueva"
```

### Task 19: Documentación

**Archivos:**
- Reescribir: `docs/diseno/identidad-y-sistema-de-diseno.md`
- Crear: `docs/diseno/imagenes.md`
- Modificar: `docs/diseno/redisenio-resend-2026-11-13.md`, `revision-referencia-noviembre.md`, `README.md`

- [ ] **Paso 1: reescribir la identidad**

Con el sistema nuevo. Conservar la estructura de tablas del documento actual.

- [ ] **Paso 2: anotar el origen de las imágenes**

`imagenes.md` con el origen, la licencia y las dimensiones de cada fotografía, y el comando exacto de generación de AVIF y WebP. La tipografía no aparece ahí: no se genera ningún subconjunto propio, se usa la compilación por eje que publica Fontsource, y eso queda explicado en el documento de identidad.

- [ ] **Paso 3: marcar lo histórico**

Encabezar los dos documentos anteriores con una línea que diga que quedan como registro histórico y remita al documento del 19 de noviembre.

- [ ] **Paso 4: actualizar el README**

Las fuentes y el techo de CSS en 36 kB.

- [ ] **Paso 5: commit**

```bash
git add docs README.md
git commit -m "docs: actualizar la identidad y registrar el origen de las imagenes"
```

---

## Fase 8. Integración y publicación

La rama predeterminada del remoto es `develop`. La rama local `main` conserva el estado histórico de v0.4.12.

1. Respaldar las referencias antes de cualquier depuración.
2. Comparar los cambios de la rama de seguridad con la versión integrada mediante el PR #165. La comprobación por ancestros se complementa con una comparación de parches.
3. Integrar el rediseño mediante un pull request a `develop` y comprobar CI.
4. Preparar una etiqueta firmada con la versión del código y desplegar mediante el entorno de producción conforme al README.
5. Verificar salud, versión y rutas principales. Las etiquetas que respaldan imágenes o despliegues se inventarían antes de definir su retención.
