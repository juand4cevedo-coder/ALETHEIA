import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CabeceraSeo } from "./CabeceraSeo.tsx";
import { PAGINAS } from "./fichas.ts";

describe("CabeceraSeo", () => {
  it("pone en el head el título, la descripción y la canónica de la ficha", () => {
    render(<CabeceraSeo meta={PAGINAS.precios} />);
    expect(document.title).toBe(PAGINAS.precios.titulo);
    expect(
      document.head.querySelector('meta[name="description"]'),
    ).toHaveAttribute("content", PAGINAS.precios.descripcion);
    expect(
      document.head.querySelector('link[rel="canonical"]'),
    ).toHaveAttribute("href", "https://aletheia.sbs/precios");
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it("una página que no se indexa lleva noindex y ninguna canónica", () => {
    render(<CabeceraSeo meta={PAGINAS.noEncontrada} />);
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
