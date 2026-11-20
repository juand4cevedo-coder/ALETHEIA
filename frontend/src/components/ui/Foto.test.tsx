import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Foto } from "./Foto.tsx";
import { ANCHOS, FOTOS, type NombreFoto } from "./fotos.ts";

// Anclado al archivo y no al directorio de trabajo: la prueba corre igual desde cualquier lugar.
const MEDIA = join(import.meta.dirname, "..", "..", "..", "public", "media");
// Se deriva del mapa: agregar una fotografía a FOTOS la incorpora a todas las pruebas de abajo.
const NOMBRES = Object.keys(FOTOS) as NombreFoto[];

/* Lee las dimensiones reales de un WebP desde su cabecera. Cubre los tres contenedores que
 * produce un codificador: VP8 con pérdida, VP8L sin pérdida y VP8X extendido. */
function dimensionesWebp(ruta: string): { ancho: number; alto: number } {
  const b = readFileSync(ruta);
  expect(b.toString("ascii", 0, 4), `${ruta} no es RIFF`).toBe("RIFF");
  expect(b.toString("ascii", 8, 12), `${ruta} no es WebP`).toBe("WEBP");
  const tipo = b.toString("ascii", 12, 16);
  if (tipo === "VP8 ") {
    return {
      ancho: b.readUInt16LE(26) & 0x3fff,
      alto: b.readUInt16LE(28) & 0x3fff,
    };
  }
  if (tipo === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { ancho: (bits & 0x3fff) + 1, alto: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (tipo === "VP8X") {
    return { ancho: b.readUIntLE(24, 3) + 1, alto: b.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`${ruta}: contenedor WebP desconocido (${tipo})`);
}

describe("Foto", () => {
  it("declara dimensiones para que no haya salto de maquetación", () => {
    render(<Foto nombre="seguridad" alt="Archivo" />);
    const img = screen.getByAltText("Archivo");
    expect(img).toHaveAttribute("width");
    expect(img).toHaveAttribute("height");
  });

  it("difiere la carga salvo cuando es prioritaria", () => {
    const { unmount } = render(<Foto nombre="seguridad" alt="Archivo" />);
    let img = screen.getByAltText("Archivo");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).not.toHaveAttribute("fetchpriority");
    expect(img).toHaveAttribute("decoding", "async");
    unmount();

    render(<Foto nombre="seguridad" alt="Archivo" prioridad />);
    img = screen.getByAltText("Archivo");
    expect(img).not.toHaveAttribute("loading");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });

  it("arma el srcset con los cuatro anchos y su descriptor", () => {
    render(<Foto nombre="cierre" alt="Camino" />);
    const img = screen.getByAltText("Camino");
    expect(img).toHaveAttribute(
      "srcset",
      [400, 800, 1200, 1600]
        .map((a) => `/media/cierre-${a}.webp ${a}w`)
        .join(", "),
    );
    expect(img).toHaveAttribute("src", "/media/cierre-800.webp");
  });

  it("usa 100vw por omisión y respeta el sizes recibido", () => {
    const { unmount } = render(<Foto nombre="pie" alt="Pie" />);
    expect(screen.getByAltText("Pie")).toHaveAttribute("sizes", "100vw");
    unmount();
    render(
      <Foto nombre="pie" alt="Pie" sizes="(min-width: 960px) 50vw, 100vw" />,
    );
    expect(screen.getByAltText("Pie")).toHaveAttribute(
      "sizes",
      "(min-width: 960px) 50vw, 100vw",
    );
  });

  it("deja pasar className y alt vacío para fotos decorativas", () => {
    render(<Foto nombre="acceso" alt="" className="x" />);
    const img = screen.getByRole("presentation");
    expect(img).toHaveClass("x");
  });

  it("el mapa conoce exactamente las fotografías que existen en disco", () => {
    const enDisco = new Set(
      readdirSync(MEDIA)
        .map((f) => /^(.+)-(400|800|1200|1600)\.webp$/.exec(f)?.[1])
        .filter((n): n is string => !!n),
    );
    expect([...enDisco].sort()).toEqual([...NOMBRES].sort());
  });
});

describe("fotografías en public/media", () => {
  it.each(NOMBRES)("%s tiene sus cuatro anchos en public/media", (nombre) => {
    expect([...ANCHOS]).toEqual([400, 800, 1200, 1600]);
    for (const ancho of ANCHOS) {
      expect(
        existsSync(join(MEDIA, `${nombre}-${ancho}.webp`)),
        `${nombre}-${ancho}.webp`,
      ).toBe(true);
    }
  });

  it.each(NOMBRES)(
    "%s: width y height declarados coinciden con el archivo",
    (nombre) => {
      const { ancho, alto } = FOTOS[nombre];
      const real = dimensionesWebp(join(MEDIA, `${nombre}-1600.webp`));
      expect(real).toEqual({ ancho, alto });

      render(<Foto nombre={nombre} alt={nombre} />);
      const img = screen.getByAltText(nombre);
      expect(img).toHaveAttribute("width", String(ancho));
      expect(img).toHaveAttribute("height", String(alto));
    },
  );

  it.each(NOMBRES)(
    "%s: cada ancho del srcset mide lo que dice su descriptor",
    (nombre) => {
      const { ancho, alto } = FOTOS[nombre];
      for (const w of ANCHOS) {
        const real = dimensionesWebp(join(MEDIA, `${nombre}-${w}.webp`));
        expect(real.ancho).toBe(w);
        // Misma proporción que la declarada, con tolerancia de un píxel por redondeo.
        expect(Math.abs(real.alto - (w * alto) / ancho)).toBeLessThanOrEqual(1);
      }
    },
  );
});
