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

    // El registro no cobra ni elige plan: cada tarjeta lleva a la misma prueba y solo le dice al
    // registro qué plan miró la persona.
    const signUp = within(main)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/registro"));
    expect(signUp[0]!.textContent).toBe("Probar 14 días gratis");
    expect(signUp.at(-1)!.textContent).toBe("Probar 14 días gratis");
    for (const plan of CATALOG) {
      const tarjeta = within(main).getByRole("article", { name: plan.name });
      expect(within(tarjeta).getByRole("link")).toHaveAttribute(
        "href",
        `/registro?plan=${plan.code}`,
      );
    }
    expect(
      within(main).getByText("Sin tarjeta de crédito. Cancele cuando quiera."),
    ).toBeInTheDocument();
    expect(
      within(main).getByText(
        "Al terminar los 14 días, usted elige el plan. Nada se cobra solo.",
      ),
    ).toBeInTheDocument();
    expect(
      within(main).getByText(/Solo cambian los usuarios y el almacenamiento/),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("link", { name: /Pedir una cotización/ }),
    ).toHaveAttribute("href", "/empresa#cotizar");
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("muestra las condiciones de compra y las preguntas antes de pagar", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    await renderRoute("/precios");
    await screen.findByRole("article", { name: "Profesional" });

    const guarantees = screen.getByRole("list", {
      name: "Condiciones de compra",
    });
    expect(guarantees).toHaveTextContent("PSE, Nequi o tarjeta");
    expect(guarantees).toHaveTextContent(
      "Cinco días hábiles para arrepentirse",
    );
    expect(guarantees).toHaveTextContent("Sus casos se exportan siempre");

    const faq = screen.getByRole("region", {
      name: "Preguntas antes de pagar",
    });
    const questions = within(faq).getAllByRole("group");
    expect(questions.length).toBeGreaterThanOrEqual(6);
    expect(questions.length).toBeLessThanOrEqual(8);

    await user.click(within(faq).getByText("¿Recibo factura electrónica?"));
    expect(within(faq).getByText(/comprobante de pago numerado/)).toBeVisible();

    // Los usuarios adicionales salen del catálogo, no del texto.
    await user.click(within(faq).getByText("¿Puedo agregar más usuarios?"));
    expect(
      within(faq).getByText(
        /Firma incluye \d+ y cada persona adicional vale \$14\.900 al mes/,
      ),
    ).toBeVisible();
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
    // En anual se ve lo que cuesta cada mes, el total del año y lo que se ahorra.
    expect(within(professional).getByText(/^\$49\.917/)).toBeInTheDocument();
    expect(
      within(professional).getByText(
        "Pagando $599.000 al año. Ahorra $119.800",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("article", { name: "Firma" })).getByText(
        "Pagando $1.499.000 al año. Ahorra $299.800",
      ),
    ).toBeInTheDocument();
  });
});
