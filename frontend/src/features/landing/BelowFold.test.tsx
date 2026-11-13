import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlanCatalogProvider } from "../billing/catalog.tsx";
import { CATALOG } from "../../test/plans.ts";
import { jsonResponse } from "../../test/render.tsx";
import { BelowFold } from "./BelowFold.tsx";

afterEach(() => vi.restoreAllMocks());

describe("Enlaces a secciones que se descargan aparte", () => {
  it.each(["#%", "#%E0%A4%A", "#seccion-inexistente"])(
    "mantiene la página disponible con el fragmento %s",
    (hash) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(CATALOG)));
      render(
        <MemoryRouter initialEntries={[`/${hash}`]}>
          <PlanCatalogProvider>
            <BelowFold />
          </PlanCatalogProvider>
        </MemoryRouter>,
      );
      expect(
        screen.getByRole("heading", {
          name: "La confianza también se comprueba.",
        }),
      ).toBeInTheDocument();
    },
  );

  it("lleva a la sección cuando llega el contenido diferido", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(CATALOG)));
    const scroll = vi.fn();
    const target = document.createElement("div");
    target.scrollIntoView = scroll;
    const find = vi.spyOn(document, "getElementById").mockReturnValue(target);
    render(
      <MemoryRouter initialEntries={["/#como-funciona"]}>
        <PlanCatalogProvider>
          <BelowFold />
        </PlanCatalogProvider>
      </MemoryRouter>,
    );
    expect(find).toHaveBeenCalledWith("como-funciona");
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});
