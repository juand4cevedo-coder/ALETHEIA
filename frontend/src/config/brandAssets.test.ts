import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function asset(path: string): Buffer {
  return readFileSync(join(ROOT, path));
}

function pngSize(path: string): [number, number] {
  const bytes = asset(path);
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("recursos de la marca", () => {
  it.each([
    "src/assets/simbolo.svg",
    "public/brand/symbol-dark.svg",
    "public/brand/symbol-white.svg",
  ])(
    "%s usa el símbolo vectorial aprobado y sigue siendo escalable",
    (path) => {
      const svg = asset(path).toString("utf8");
      expect(svg).toContain('data-brand="aletheia-eye"');
      expect(svg).toMatch(/viewBox="0 0 64 64"/);
      expect(svg).not.toMatch(/<svg[^>]+(?:width|height)=/);
      expect(svg).not.toMatch(/<(?:image|script)|(?:href|src)="https?:\/\//);
    },
  );

  it("conserva el mismo símbolo en el favicon", () => {
    const svg = asset("public/favicon.svg").toString("utf8");
    expect(svg).toContain('data-brand="aletheia-eye"');
    expect(svg).toContain('data-variant="small"');
    expect(svg).toMatch(/viewBox="0 0 64 64"/);
  });

  it.each([
    ["public/favicon.png", 32],
    ["public/apple-touch-icon.png", 180],
    ["public/icon-192.png", 192],
    ["public/icon-512.png", 512],
    ["public/email/logo-claro.png", 128],
  ] as const)("%s tiene %i píxeles cuadrados", (path, size) => {
    expect(pngSize(path)).toEqual([size, size]);
  });

  it("publica una imagen social en formato panorámico", () => {
    expect(pngSize("public/og-image.png")).toEqual([1200, 630]);
  });

  it("publica favicon clásico y los tamaños instalables", () => {
    const html = asset("index.html").toString("utf8");
    const manifest = JSON.parse(
      asset("public/site.webmanifest").toString("utf8"),
    ) as {
      icons: { sizes: string; purpose?: string }[];
    };
    expect(html).toContain('href="/favicon.ico?v=3"');
    expect(html).toContain('sizes="180x180"');
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192" }),
        expect.objectContaining({ sizes: "512x512", purpose: "any maskable" }),
      ]),
    );
  });
});
