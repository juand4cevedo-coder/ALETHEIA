/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Se lee del disco: en las pruebas, Vite entrega vacío todo CSS importado, incluso con ?raw.
const tokensCss = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");

// Colores semánticos de la identidad (especificación de identidad, sección 3). Un cambio de
// valor aquí es un cambio de identidad y debe pasar antes por la especificación.
const SEMANTIC_COLORS: Record<string, string> = {
  "--bg": "#000000",
  "--surface-1": "#0E0F11",
  "--surface-2": "#1A1B1E",
  "--line": "#252629",
  "--line-control": "#686B70",
  "--text": "#F0F0F0",
  "--text-2": "#A1A4A5",
  "--text-3": "#999DA3",
  "--accent": "#F0F0F0",
  "--accent-strong": "#FFFFFF",
  "--on-accent": "#08090B",
  "--ok": "#63D4A1",
  "--warn": "#E8BA75",
  "--err": "#FF9999",
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

function luminance(token: string): number {
  const color = declaredValue(token)!;
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort(
    (left, right) => right - left,
  );
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe("legibilidad de la identidad", () => {
  it.each(["--bg", "--surface-1", "--surface-2"])(
    "el texto y los estados alcanzan AA sobre %s",
    (surface) => {
      for (const foreground of [
        "--text",
        "--text-2",
        "--text-3",
        "--accent",
        "--accent-strong",
        "--ok",
        "--warn",
        "--err",
        "--bronze",
      ]) {
        expect(
          contrast(foreground, surface),
          foreground,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast("--line-control", surface)).toBeGreaterThanOrEqual(3);
    },
  );
  it("mantiene contraste en botones y superficies oscuras", () => {
    expect(contrast("--gold", "--brand-dark")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--gold-hover", "--brand-dark")).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast("--on-accent", "--accent")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--on-accent", "--accent-strong")).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrast("--on-brand", "--brand-dark")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--brand-muted", "--brand-dark")).toBeGreaterThanOrEqual(
      4.5,
    );
  });
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
