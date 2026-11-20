import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Un SVG que no es XML válido no abre: el navegador muestra la imagen rota. En la revisión de
// código no se nota (un «--» dentro de un comentario parece inofensivo), por eso se comprueba
// aquí que cada archivo se parsea.
const RAIZ = join(import.meta.dirname, "..", "..");
const CARPETAS = ["frontend/src", "frontend/public", "docs/diseno"];

function svgs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      return entrada.name === "node_modules" ? [] : svgs(ruta);
    }
    return entrada.name.endsWith(".svg") ? [ruta] : [];
  });
}

const ARCHIVOS = CARPETAS.flatMap((carpeta) =>
  svgs(join(RAIZ, carpeta)).map((ruta) =>
    relative(RAIZ, ruta).replaceAll("\\", "/"),
  ),
);

describe("Archivos SVG del repositorio", () => {
  it("se encontraron SVG que comprobar", () => {
    expect(ARCHIVOS.length).toBeGreaterThan(0);
  });

  it.each(ARCHIVOS)("%s es XML válido", (archivo) => {
    const doc = new DOMParser().parseFromString(
      readFileSync(join(RAIZ, archivo), "utf8"),
      "image/svg+xml",
    );
    const error = doc.querySelector("parsererror");
    expect(error?.textContent ?? null, `${archivo} no abre`).toBeNull();
    expect(doc.documentElement.localName).toBe("svg");
  });
});
