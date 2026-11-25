/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Se lee del disco: en las pruebas, Vite entrega vacío todo CSS importado, incluso con ?raw.
const tokensCss = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");

// Colores semánticos de la identidad vigente (ADR-049). Un cambio de valor aquí es un cambio de
// identidad y debe pasar antes por ese registro.
const SEMANTIC_COLORS: Record<string, string> = {
  "--paper": "#FFFFFF",
  "--paper-raised": "#FFFFFF",
  "--paper-sunken": "#F4F4F4",
  "--ink-900": "#820AD1",
  "--ink-700": "#5F007D",
  "--ink-500": "#7209B7",
  "--brass-600": "#820AD1",
  "--brass-400": "#D9A6F7",
  "--text": "#111111",
  "--text-2": "#4B4B4B",
  "--text-3": "#676767",
  "--on-ink": "#FFFFFF",
  "--on-ink-2": "#F1DCFF",
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
      // El acento claro es decorativo (filetes y marcas sobre la marca): 3 a 1 basta.
      expect(contrast("--brass-400", surface)).toBeGreaterThanOrEqual(3);
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

describe("variables CSS", () => {
  it("todo var(--nombre) sin valor de respaldo tiene una definición", () => {
    // Una variable sin definir deja la propiedad en su valor inicial sin avisar: un fondo
    // transparente con texto blanco, un margen en cero. Una definición puede estar en un
    // archivo de estilos, en un style de React o en un setProperty.
    const files = sourceFiles(SRC).filter(
      (path) => !path.includes("generated"),
    );
    const defined = new Set<string>();
    const used = new Map<string, string>();
    for (const path of files) {
      const text = readFileSync(path, "utf8");
      for (const match of text.matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
        defined.add(match[1]!);
      }
      for (const match of text.matchAll(/["'`](--[a-z0-9-]+)["'`]/gi)) {
        defined.add(match[1]!);
      }
      for (const match of text.matchAll(/var\((--[a-z0-9-]+)(\s*,)?/gi)) {
        if (!match[2]) used.set(match[1]!, relative(SRC, path));
      }
    }
    const missing = [...used].filter(([name]) => !defined.has(name));
    expect(missing).toEqual([]);
  });
});

// El modo oscuro tiene su propia paleta: se comprueba igual que la clara, contra sus superficies.
const darkBlock =
  /:root\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? "";

function darkValue(name: string): string {
  const found = new RegExp(String.raw`${name}:\s*(#[0-9a-fA-F]{6})`).exec(
    darkBlock,
  )?.[1];
  return found ?? declaredValue(name)!;
}

function luminanceOf(color: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function ratio(a: string, b: string): number {
  const [high, low] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

describe("legibilidad del modo oscuro", () => {
  it("declara su propia paleta", () => {
    expect(darkBlock).toMatch(/--paper:\s*#/);
    expect(darkBlock).toMatch(/color-scheme:\s*dark/);
  });

  it.each(["--paper", "--paper-raised", "--paper-sunken"])(
    "el texto, los enlaces y los estados alcanzan AA sobre %s",
    (surface) => {
      for (const foreground of [
        "--text",
        "--text-2",
        "--text-3",
        "--brand-text",
        "--brand-text-strong",
        "--brass-600",
        "--ink-500",
        "--ok",
        "--warn",
        "--err",
      ]) {
        expect(
          ratio(darkValue(foreground), darkValue(surface)),
          `${foreground} sobre ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("el texto sobre el violeta de relleno alcanza AA en los dos modos", () => {
    for (const ink of [declaredValue("--ink-900")!, darkValue("--ink-900")]) {
      expect(ratio("#ffffff", ink)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(darkValue("--on-ink-2"), ink)).toBeGreaterThanOrEqual(4.5);
    }
    for (const ink of [declaredValue("--ink-700")!, darkValue("--ink-700")])
      expect(ratio("#ffffff", ink)).toBeGreaterThanOrEqual(4.5);
  });

  it("los contornos de los controles alcanzan 3 a 1 sobre el papel oscuro", () => {
    expect(
      ratio(darkValue("--line-control"), darkValue("--paper-raised")),
    ).toBeGreaterThanOrEqual(3);
    expect(
      ratio(darkValue("--ink-900"), darkValue("--paper")),
    ).toBeGreaterThanOrEqual(3);
  });
});
