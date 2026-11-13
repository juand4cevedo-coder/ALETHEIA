import { render } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CadenaIcon,
  CargandoIcon,
  HuellaIcon,
  PaqueteIcon,
  SelloIcon,
} from "./icons.tsx";

const SRC = join(import.meta.dirname, "..", "..");
const IGNORADOS = new Set(["node_modules", "generated"]);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    if (IGNORADOS.has(nombre)) return [];
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

describe("Íconos de la interfaz", () => {
  it("ningún archivo de src importa lucide-react ni @phosphor-icons", () => {
    const infractores = archivos(SRC).filter((ruta) =>
      /(?:from[ ]+|import[(][ ]*)["'](?:lucide-react|@phosphor-icons)/.test(
        readFileSync(ruta, "utf8"),
      ),
    );
    expect(infractores).toEqual([]);
  });

  it("los íconos son decorativos salvo que se les dé un título", () => {
    const { container, rerender } = render(<CargandoIcon />);
    const decorativo = container.querySelector("svg");
    expect(decorativo).toHaveAttribute("aria-hidden", "true");
    expect(decorativo).toHaveAttribute("width", "16");

    rerender(<CargandoIcon title="Cargando" size={20} />);
    const nombrado = container.querySelector("svg");
    expect(nombrado).not.toHaveAttribute("aria-hidden");
    expect(nombrado).toHaveAttribute("role", "img");
    expect(nombrado?.querySelector("title")).toHaveTextContent("Cargando");
  });

  it.each([
    ["HuellaIcon", HuellaIcon],
    ["SelloIcon", SelloIcon],
    ["CadenaIcon", CadenaIcon],
    ["PaqueteIcon", PaqueteIcon],
  ])("%s usa el trazo común de 1,5 y hereda el color", (_nombre, Icono) => {
    const { container } = render(<Icono />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "1.5");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
  });

  it.each([
    ["HuellaIcon", HuellaIcon],
    ["SelloIcon", SelloIcon],
    ["CadenaIcon", CadenaIcon],
    ["PaqueteIcon", PaqueteIcon],
  ])("%s conserva su dibujo", (_nombre, Icono) => {
    const { container } = render(<Icono />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
