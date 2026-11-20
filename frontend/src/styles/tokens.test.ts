/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Se lee del disco: en las pruebas, Vite entrega vacío todo CSS importado, incluso con ?raw.
const tokensCss = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");

// Colores semánticos de la identidad (especificación del rediseño del 19 de noviembre, sección
// 7.1). Un cambio de valor aquí es un cambio de identidad y debe pasar antes por la especificación.
const SEMANTIC_COLORS: Record<string, string> = {
  "--paper": "#F4F1EA",
  "--paper-raised": "#FFFFFF",
  "--paper-sunken": "#E9E4D8",
  "--ink-900": "#071423",
  "--ink-700": "#12304F",
  "--ink-500": "#1E4A74",
  "--brass-600": "#7E5F36",
  "--brass-400": "#C3A572",
  "--text": "#111820",
  "--text-2": "#49545F",
  "--text-3": "#5C656F",
  "--on-ink": "#F4F1EA",
  "--on-ink-2": "#A9B6C4",
  "--ok": "#1F6B4A",
  "--warn": "#8A5A18",
  "--err": "#9B2226",
};

function declaredValue(name: string): string | undefined {
  for (const match of tokensCss.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) {
    if (match[1] === name) return match[2]?.trim();
  }
  return undefined;
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
  it.each(["--paper", "--paper-raised", "--paper-sunken"])(
    "el texto y los estados alcanzan AA sobre %s",
    (surface) => {
      for (const foreground of [
        "--text",
        "--text-2",
        "--text-3",
        "--ink-500",
        "--brass-600",
        "--ok",
        "--warn",
        "--err",
      ]) {
        expect(
          contrast(foreground, surface),
          foreground,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
  it.each(["--paper", "--paper-raised", "--paper-sunken"])(
    "el contorno de los controles alcanza 3 a 1 sobre %s",
    (surface) => {
      expect(contrast("--line-control", surface)).toBeGreaterThanOrEqual(3);
    },
  );
  it("mantiene contraste sobre las superficies de tinta", () => {
    for (const surface of ["--ink-900", "--ink-700"]) {
      expect(contrast("--on-ink", surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast("--on-ink-2", surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast("--brass-400", surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast("--paper", "--ink-900")).toBeGreaterThanOrEqual(4.5);
  });
});

// Nombres del sistema anterior que el puente traducía a los tokens nuevos. Ya no existen: un
// módulo que los use se quedaría sin color, tamaño o duración sin que nada falle.
const RETIRED_NAMES = [
  "shadow-raised",
  "font-display",
  "motion-flash",
  "motion-slow",
  "bg",
  "surface-0",
  "surface-1",
  "surface-1b",
  "surface-2",
  "line",
  "line-accent",
  "accent",
  "accent-strong",
  "accent-nav",
  "on-accent",
  "on-brand",
  "gold",
  "gold-hover",
  "brand-dark",
  "brand-muted",
  "brand-line",
  "bronze",
  "tint-integridad",
  "tint-seguridad",
];
// El cierre no puede ser \b (borde de palabra): coincide antes de un guion, y los tokens
// vivos de la escala tipográfica comparten prefijo con los retirados (--line-height-body frente
// a --line). Sin bandera g, para que test no arrastre lastIndex entre llamadas.
const RETIRED_TOKENS = new RegExp(
  `--color-[a-z0-9]|--(?:${RETIRED_NAMES.join("|")})(?![\\w-])`,
);
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

// Fuera de "tokens retirados" a propósito: esta prueba no depende del resto de src y debe
// correr aun cuando se excluya el inventario de archivos pendientes.
describe("patrón de los tokens retirados", () => {
  it("distingue un token retirado de uno vivo que comparte prefijo", () => {
    expect(RETIRED_TOKENS.test("--line:")).toBe(true);
    expect(RETIRED_TOKENS.test("--line-height-body:")).toBe(false);
    expect(RETIRED_TOKENS.test("--accent:")).toBe(true);
    expect(RETIRED_TOKENS.test("--accent-strong:")).toBe(true);
    expect(RETIRED_TOKENS.test("--brass-hairline:")).toBe(false);
  });
});

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
