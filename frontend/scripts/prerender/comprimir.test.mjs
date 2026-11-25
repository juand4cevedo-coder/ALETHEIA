import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { comprimirCarpeta } from "./comprimir.mjs";

let carpeta;

beforeEach(() => {
  carpeta = mkdtempSync(join(tmpdir(), "aletheia-comprimir-"));
});
afterEach(() => {
  rmSync(carpeta, { recursive: true, force: true });
});

describe("comprimirCarpeta", () => {
  it("deja junto a cada archivo de texto su versión Brotli y gzip, también en subcarpetas", () => {
    const html = "<p>Aletheia</p>\n".repeat(200);
    mkdirSync(join(carpeta, "precios"));
    writeFileSync(join(carpeta, "precios", "index.html"), html);
    writeFileSync(join(carpeta, "app.js"), "const a = 1;\n".repeat(200));

    expect(comprimirCarpeta(carpeta)).toBe(2);
    const ruta = join(carpeta, "precios", "index.html");
    expect(brotliDecompressSync(readFileSync(ruta + ".br")).toString()).toBe(
      html,
    );
    expect(gunzipSync(readFileSync(ruta + ".gz")).toString()).toBe(html);
    expect(existsSync(join(carpeta, "app.js.br"))).toBe(true);
  });

  it("no toca imágenes, archivos pequeños ni carpetas ocultas", () => {
    writeFileSync(join(carpeta, "foto.webp"), Buffer.alloc(4096));
    writeFileSync(join(carpeta, "robots.txt"), "User-agent: *\n");
    mkdirSync(join(carpeta, ".vite"));
    writeFileSync(join(carpeta, ".vite", "manifest.json"), "{}".repeat(1000));

    expect(comprimirCarpeta(carpeta)).toBe(0);
    expect(existsSync(join(carpeta, "foto.webp.br"))).toBe(false);
    expect(existsSync(join(carpeta, "robots.txt.br"))).toBe(false);
    expect(existsSync(join(carpeta, ".vite", "manifest.json.br"))).toBe(false);
  });
});
