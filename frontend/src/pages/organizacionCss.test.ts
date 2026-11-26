import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// jsdom no aplica CSS Modules: estas pruebas leen del disco las reglas que sostienen el celular y
// los componentes compartidos. Cada una fija una causa medida en el navegador; si alguien la
// revierte, falla aquí.
const SRC = join(import.meta.dirname, "..");

function read(path: string): string {
  return readFileSync(join(SRC, path), "utf8");
}

function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.()>[\]="]/g, String.raw`\$&`);
  const found = new RegExp(String.raw`(?:^|\n)${escaped}\s*\{([^}]*)\}`).exec(
    css,
  );
  return found?.[1] ?? "";
}

function containerBreakpoint(css: string): number {
  return Number(/@container \(max-width: (\d+)px\)/.exec(css)?.[1]);
}

// Medidas en el navegador con las fuentes del producto.
const PANEL_PADDING = 2 * 24;

describe("tarjeta de la persona en miembros", () => {
  const css = read("pages/MembersPage.module.css");

  it("el corte se mide contra el contenedor y no contra la ventana", () => {
    expect(containerBreakpoint(css)).toBeGreaterThan(0);
    expect(rule(css, ".screen")).toMatch(/container-type:\s*inline-size/);
    expect(css).not.toMatch(/@media \(max-width: 720px\)/);
  });

  it("cuando la tabla aparece, la persona tiene 240 px de texto", () => {
    // Columnas medidas a 1280 px: el rol más largo (Administrador), la fecha de ingreso y las
    // dos acciones. La columna de la persona es lo que sobra.
    const ROLE = 97;
    const DATE = 209;
    const ACTIONS = 233;
    const gap = Number(
      /column-gap:\s*var\(--space-(\d+)\)/.exec(rule(css, ".rows"))?.[1],
    );
    const GAPS = 3 * { 6: 24 }[gap]!;
    const table = containerBreakpoint(css) + 1 - PANEL_PADDING;
    expect(table - ROLE - DATE - ACTIONS - GAPS).toBeGreaterThanOrEqual(240);
  });
});

describe("tarjeta del evento en auditoría", () => {
  const css = read("pages/OrganizationAuditPage.module.css");

  it("el corte se mide contra el contenedor y la tabla reparte sus anchos", () => {
    expect(containerBreakpoint(css)).toBeGreaterThan(0);
    expect(rule(css, ".screen")).toMatch(/container-type:\s*inline-size/);
    expect(rule(css, ".table")).toMatch(/table-layout:\s*fixed/);
    // Sin ancho mínimo fijo: era el que obligaba a desplazarse de lado.
    expect(rule(css, ".table")).not.toMatch(/min-width/);
  });

  // El criterio no es un número universal: es que el contenido típico de la columna quepa sin
  // partirse a mitad de palabra. Los 240 px de la lista de casos salen de sus títulos, texto libre
  // y largo ("Acción de tutela por vulneración del derecho fundamental al debido proceso
  // administrativo"), que por debajo de eso se rompen en una escalera de renglones. Un nombre de
  // persona es corto y estructurado: 150 px sostienen un nombre colombiano completo en dos líneas
  // sin romper ninguna palabra. Exigir 240 px con seis columnas pediría unos 1400 px de ancho útil
  // y dejaría la pantalla en tarjetas en casi todos los monitores.
  //
  // La prueba cubre las seis columnas, cada una con lo que su contenido típico necesita. Las
  // cifras son el texto más largo sin espacios que la columna recibe, medido en el navegador con
  // Inter a 15 px: fecha "7:00:00 a. m." 95 (el día y la hora bajan de renglón, la hora no se parte); acción "Reutilización" 92; dirección IPv4
  // "192.168.100.200" 112; "AppleWebKit/537.36" del navegador 144. Persona y objeto son nombres
  // y llevan el criterio de arriba.
  it("los seis anchos suman cien y cada columna conserva el texto de su contenido típico", () => {
    const share = (n: number) =>
      Number(
        /width:\s*(\d+)%/.exec(
          rule(css, `.table thead th:nth-child(${n})`),
        )?.[1],
      );
    const shares = [1, 2, 3, 4, 5, 6].map(share);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    const NEEDS = {
      Fecha: 95,
      Acción: 92,
      Persona: 150,
      Objeto: 150,
      "Dirección IP": 112,
      Navegador: 144,
    };
    const CELL_PADDING = 2 * 12;
    const table = containerBreakpoint(css) + 1 - PANEL_PADDING;
    Object.entries(NEEDS).forEach(([name, need], index) => {
      const text = (table * shares[index]!) / 100 - CELL_PADDING;
      expect(text, name).toBeGreaterThanOrEqual(need);
    });
  });

  it("los encabezados no se parten y la celda solo corta como último recurso", () => {
    expect(rule(css, ".table thead th")).toMatch(/white-space:\s*nowrap/);
    expect(rule(css, ".table th,\n.table td")).toMatch(
      /overflow-wrap:\s*break-word/,
    );
  });
});

describe("resumen del inicio", () => {
  it("las cuatro cifras pasan a dos columnas según el ancho de la pantalla", () => {
    const css = read("pages/WorkspacePage.module.css");
    expect(rule(css, ".screen")).toMatch(/container-type:\s*inline-size/);
    // Con cuatro en fila, tres separaciones de 16 px: cada tarjeta mide casi 200 px, que es lo
    // que necesita "No disponible" en una sola línea (medido a 1200 px de ventana).
    const breakpoint = containerBreakpoint(css);
    expect((breakpoint + 1 - 3 * 16) / 4).toBeGreaterThanOrEqual(195);
    expect(css).not.toMatch(/@media \(max-width: 760px\)/);
  });
});

describe("componentes compartidos", () => {
  it("la cifra del resumen no se parte a la mitad de una palabra", () => {
    const css = read("components/ui/StatTile.module.css");
    const value = rule(css, ".value");
    expect(value).not.toMatch(/overflow-wrap:\s*(anywhere|break-word)/);
    expect(value).not.toMatch(/word-break:\s*(break-all|break-word)/);
    expect(value).toMatch(/overflow-wrap:\s*normal/);
    // Si no cabe se reduce: el tamaño sigue al ancho de su tarjeta.
    expect(value).toMatch(/font-size:\s*clamp\([^)]*cqi/);
    expect(rule(css, ".tile")).toMatch(/container-type:\s*inline-size/);
  });

  it("el botón de copiar la huella alcanza el objetivo táctil", () => {
    const copy = rule(read("components/ui/Hash.module.css"), ".copy");
    expect(copy).toMatch(/min-height:\s*var\(--touch-target\)/);
    expect(copy).toMatch(/min-width:\s*var\(--touch-target\)/);
  });

  it("el menú de la cuenta usa el token del filete y no el literal", () => {
    const css = read("features/session/AccountMenu.module.css");
    expect(css).not.toMatch(/rgb\(7 20 35 \/ 10%\)/);
    expect(css).toMatch(/var\(--ink-hairline\)/);
  });
});

describe("pantallas de organización y cuenta", () => {
  const FILES = [
    "pages/MembersPage.module.css",
    "pages/OrganizationPage.module.css",
    "pages/OrganizationAuditPage.module.css",
    "pages/AccountPage.module.css",
    "pages/SupportPage.module.css",
    "pages/ExportDownloadPage.module.css",
    "pages/WorkspacePage.module.css",
    "features/members/InviteDialog.module.css",
    "components/ui/Dialog.module.css",
    "components/ui/Panel.module.css",
  ];

  it.each(FILES)("%s no repite el literal del filete de tinta", (file) => {
    expect(read(file)).not.toMatch(/rgb\(7 20 35 \/ 10%\)/);
  });

  // En contraste forzado de Windows las sombras se descartan: sin un borde, el panel deja de tener
  // límite y el texto parece flotar. Un borde transparente de un píxel no se ve normalmente y el
  // sistema lo pinta con su color propio (especificación, sección 7.3). No es sobrante: no lo borre.
  it.each([
    ["components/ui/Panel.module.css", ".panel"],
    ["components/ui/Dialog.module.css", ".dialog"],
    ["components/ui/EmptyState.module.css", ".aside"],
    ["pages/MembersPage.module.css", ".seats"],
    ["pages/WorkspacePage.module.css", ".verify"],
    ["pages/ExportDownloadPage.module.css", ".card"],
  ])(
    "%s: %s lleva borde transparente de un píxel junto a su sombra",
    (file, selector) => {
      const body = rule(read(file), selector);
      expect(body).toMatch(/box-shadow:[^;]*var\(--shadow-(card|float)\)/);
      expect(body).toMatch(/border:\s*1px solid transparent/);
    },
  );

  it("el diálogo y el panel son papel elevado con sombra, no un contorno", () => {
    const dialog = rule(read("components/ui/Dialog.module.css"), ".dialog");
    expect(dialog).toMatch(/background:\s*var\(--paper-raised\)/);
    expect(dialog).toMatch(/box-shadow:[^;]*var\(--shadow-float\)/);
    const panel = rule(read("components/ui/Panel.module.css"), ".panel");
    expect(panel).toMatch(/background:\s*var\(--paper-raised\)/);
    expect(panel).toMatch(/box-shadow:[^;]*var\(--shadow-card\)/);
  });
});

describe("indicadores del resumen", () => {
  it("se separan del fondo con un filete visible, que también se ve en alto contraste", () => {
    const tile = rule(read("components/ui/StatTile.module.css"), ".tile");
    expect(tile).toMatch(/border:\s*1px solid var\(--ink-hairline\)/);
    expect(tile).not.toMatch(/box-shadow/);
  });
});
