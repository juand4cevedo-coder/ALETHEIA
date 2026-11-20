import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// jsdom no aplica CSS Modules: estas pruebas leen del disco las reglas que sostienen el celular.
// Cada una fija una causa medida en el navegador a 375 px; si alguien la revierte, falla aquí.
const SRC = join(import.meta.dirname, "..");

function read(path: string): string {
  return readFileSync(join(SRC, path), "utf8");
}

function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.()>]/g, String.raw`\$&`);
  const found = new RegExp(String.raw`(?:^|\n)${escaped}\s*\{([^}]*)\}`).exec(
    css,
  );
  return found?.[1] ?? "";
}

const COLUMN = /grid-template-columns:\s*minmax\(0,\s*1fr\)/;

describe("reglas del celular en las pantallas de casos", () => {
  it("las pestañas del caso miden al menos el objetivo táctil", () => {
    expect(rule(read("pages/CasePage.module.css"), ".tab")).toMatch(
      /min-height:\s*var\(--touch-target\)/,
    );
  });

  it("el formulario de evidencias y cada uno de sus campos acotan la columna", () => {
    const css = read("features/cases/EvidenceUploadForm.module.css");
    expect(rule(css, ".form")).toMatch(COLUMN);
    expect(rule(css, ".form > div")).toMatch(COLUMN);
  });

  it("la evidencia acota su columna y deja que las acciones bajen de línea", () => {
    const css = read("pages/EvidenceDetailPage.module.css");
    expect(rule(css, ".screen")).toMatch(COLUMN);
    expect(rule(css, ".actions")).toMatch(/flex-wrap:\s*wrap/);
  });

  it("el radio del segmento cubre también el borde", () => {
    expect(rule(read("pages/CasesPage.module.css"), ".segmentInput")).toMatch(
      /inset:\s*-1px/,
    );
  });

  it("cuando la tabla aparece, la columna del título tiene 240 px de texto", () => {
    const page = read("pages/CasesPage.tsx");
    const css = read("pages/CasesPage.module.css");
    const breakpoint = Number(
      /CARDS_QUERY = "\(max-width: (\d+)px\)"/.exec(page)?.[1],
    );
    const share = [2, 3, 4].reduce((sum, n) => {
      const body = rule(css, `.table thead th:nth-child(${n})`);
      return sum + Number(/width:\s*(\d+)%/.exec(body)?.[1]);
    }, 0);
    const SIDEBAR = 240;
    const MAIN_PADDING = 2 * 48;
    const STATUS_COLUMN = 10.75 * 16;
    const CELL_PADDING = 24 + 12;
    const table = Math.min(breakpoint + 1 - SIDEBAR - MAIN_PADDING, 1120 - 96);
    const text = (table * (100 - share)) / 100 - STATUS_COLUMN - CELL_PADDING;
    expect(text).toBeGreaterThanOrEqual(240);
  });
});

// En contraste forzado de Windows las sombras se descartan: sin un borde la superficie elevada
// pierde su límite. El borde transparente no se ve y el sistema lo pinta (especificación, sección
// 7.3). No es sobrante: no lo borre.
describe("superficies elevadas de las pantallas de casos", () => {
  it.each([
    ["pages/CasesPage.module.css", ".book"],
    ["pages/CasesPage.module.css", ".card"],
    ["pages/CasePage.module.css", ".case"],
    ["pages/NewCasePage.module.css", ".compose"],
    ["features/cases/CustodyStrip.module.css", ".strip"],
    ["features/cases/EvidenceSection.module.css", ".item"],
    ["features/cases/OpeningRecordPreview.module.css", ".record"],
  ])("%s: %s lleva borde transparente de un píxel", (file, selector) => {
    const body = rule(read(file), selector);
    expect(body).toMatch(/box-shadow:[^;]*var\(--shadow-card\)/);
    expect(body).toMatch(/border:\s*1px solid transparent/);
  });

  it("el libro en tarjetas quita el borde junto con la sombra y el fondo", () => {
    // Sin esto queda un marco de 1 px alrededor de la lista, y en colores forzados se pinta como
    // un segundo marco sobre las tarjetas, que ya llevan el suyo.
    const body = rule(
      read("pages/CasesPage.module.css"),
      ".book:has(> .cards)",
    );
    expect(body).toMatch(/box-shadow:\s*none/);
    expect(body).toMatch(/border:\s*0\b/);
  });
});
