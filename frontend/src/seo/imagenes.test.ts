import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { paginasPublicas } from "./servidor.tsx";

// La carpeta public/ del proyecto: las imágenes se sirven desde la raíz del sitio.
const PUBLICO = join(import.meta.dirname, "../../public");

describe("imágenes para compartir", () => {
  it("cada página pública tiene en public/ la imagen que declara", () => {
    for (const { meta } of paginasPublicas()) {
      expect(
        existsSync(join(PUBLICO, meta.imagen)),
        `${meta.ruta} declara ${meta.imagen}; genérela con scripts/imagenes-sociales.mjs`,
      ).toBe(true);
    }
  });

  it("cada artículo del blog tiene una imagen propia", () => {
    const articulos = paginasPublicas().filter(
      ({ meta }) => meta.tipo === "article",
    );
    expect(articulos.length).toBeGreaterThan(0);
    for (const { meta } of articulos) {
      expect(meta.imagen).toBe(
        `/og${meta.ruta.replace("/blog/", "/blog-")}.png`,
      );
    }
  });
});
