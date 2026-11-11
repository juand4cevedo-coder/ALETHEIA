/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Se lee del disco: en las pruebas, Vite entrega vacío todo CSS importado, incluso con ?raw.
const tokensCss = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");

// Colores semánticos de la identidad (especificación de identidad, sección 3). Un cambio de
// valor aquí es un cambio de identidad y debe pasar antes por la especificación.
const SEMANTIC_COLORS: Record<string, string> = {
  "--bg": "#0D0F13",
  "--surface-1": "#13161C",
  "--surface-2": "#191D25",
  "--line": "#232834",
  "--line-control": "#646D80",
  "--text": "#EEF1F6",
  "--text-2": "#9AA3B2",
  "--text-3": "#7D8799",
  "--accent": "#8B7CF6",
  "--accent-strong": "#B4A9FF",
  "--on-accent": "#0D0B1D",
  "--ok": "#3ECF8E",
  "--warn": "#F2B33D",
  "--err": "#F2665A",
};

function declaredValue(name: string): string | undefined {
  const escaped = name.replace(/[-]/g, "\\-");
  const match = new RegExp(`(?:^|[\\s;{])${escaped}\\s*:\\s*([^;]+);`).exec(
    tokensCss,
  );
  return match?.[1]?.trim();
}

describe("tokens.css", () => {
  it.each(Object.entries(SEMANTIC_COLORS))(
    "declara %s con el valor %s",
    (name, value) => {
      expect(declaredValue(name)?.toLowerCase()).toBe(value.toLowerCase());
    },
  );
});
