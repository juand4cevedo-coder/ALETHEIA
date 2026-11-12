/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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

// Nombres del sistema anterior que el puente traducía a los tokens nuevos. Ya no existen: un
// módulo que los use se quedaría sin color, tamaño o duración sin que nada falle.
const RETIRED_TOKENS =
  /--color-[a-z0-9]|--shadow-raised\b|--font-display\b|--motion-(?:flash|slow)\b/;
const SRC = join(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "generated" || name === "node_modules") return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(css|ts|tsx)$/.test(name) && !name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

describe("tokens retirados", () => {
  it("ningún archivo de src usa los nombres del sistema anterior", () => {
    // Este archivo nombra los tokens retirados en la expresión que los busca.
    const offenders = sourceFiles(SRC).filter(
      (path) =>
        path !== import.meta.filename &&
        RETIRED_TOKENS.test(readFileSync(path, "utf8")),
    );
    expect(offenders.map((path) => relative(SRC, path))).toEqual([]);
  });
});
