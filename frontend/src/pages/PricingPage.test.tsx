import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { seriousAxeViolations } from "../test/axe.ts";
import { CATALOG } from "../test/plans.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Planes y precios (UI-002, HU-002)", () => {
  it("muestra cada plan del catálogo con una sola acción principal", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const { container } = await renderRoute("/precios");
    const main = screen.getByRole("main");

    expect(
      within(main).getByRole("heading", { level: 1, name: "Planes y precios" }),
    ).toBeInTheDocument();
    expect(await within(main).findByText(/^\$59\.900/)).toBeInTheDocument();
    // Cada plan es un artículo con su nombre; los precios salen del catálogo.
    for (const plan of CATALOG) {
      expect(
        within(main).getByRole("article", { name: plan.name }),
      ).toBeInTheDocument();
    }
    expect(within(main).getByText("Recomendado")).toBeInTheDocument();

    // El registro no elige plan: no hay un «Elegir» por tarjeta, sino una sola invitación a
    // crear la cuenta, que dice qué pasa al pulsarla.
    const signUp = within(main)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/registro"));
    expect(signUp).toHaveLength(1);
    expect(signUp[0]).toHaveTextContent("Crear una cuenta");
    expect(signUp[0]).toHaveAttribute("href", "/registro");
    for (const plan of CATALOG) {
      expect(
        within(
          within(main).getByRole("article", { name: plan.name }),
        ).queryByRole("link"),
      ).not.toBeInTheDocument();
    }
    expect(
      within(main).getByText(
        "La cuenta nueva empieza con 14 días de prueba gratuita, sin tarjeta de crédito.",
      ),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("link", { name: /Pedir una cotización/ }),
    ).toHaveAttribute("href", expect.stringContaining("mailto:"));
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("al elegir el pago anual cambia los precios de todos los planes", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    await renderRoute("/precios");

    const professional = await screen.findByRole("article", {
      name: "Profesional",
    });
    expect(within(professional).getByText(/^\$59\.900/)).toBeInTheDocument();

    // Todos los planes de pago cobran diez meses al año: dos meses gratis.
    await user.click(screen.getByRole("radio", { name: /Anual/ }));
    expect(screen.getByRole("radio", { name: /Anual/ })).toBeChecked();
    expect(screen.getByText("2 meses gratis")).toBeInTheDocument();
    expect(within(professional).getByText(/^\$599\.000/)).toBeInTheDocument();
    expect(
      within(professional).getByText("El valor de 10 meses"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("article", { name: "Firma" })).getByText(
        /^\$1\.499\.000/,
      ),
    ).toBeInTheDocument();
  });
});
