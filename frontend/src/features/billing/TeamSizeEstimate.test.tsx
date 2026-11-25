import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { seriousAxeViolations } from "../../test/axe.ts";
import { cheapestPlanFor } from "./plans.ts";
import { CATALOGO_PUBLICADO } from "./published.ts";
import { TeamSizeEstimate } from "./TeamSizeEstimate.tsx";

describe("plan más barato por tamaño del equipo", () => {
  it.each([
    [1, "Esencial", 29_900],
    [2, "Esencial", 29_900],
    [3, "Profesional", 59_900],
    [5, "Profesional", 59_900 + 19_900],
    [9, "Firma", 149_900],
    [12, "Firma", 149_900 + 2 * 14_900],
  ])("%i personas pagan %s", (people, name, monthly) => {
    const best = cheapestPlanFor(CATALOGO_PUBLICADO, people)!;
    expect(best.plan.name).toBe(name);
    expect(best.monthly).toBe(monthly);
  });

  it("nunca recomienda la prueba gratuita", () => {
    expect(cheapestPlanFor(CATALOGO_PUBLICADO, 1)!.plan.code).not.toBe(
      "trial",
    );
  });
});

describe("TeamSizeEstimate", () => {
  it("cambia el plan y el total al escribir otro tamaño, sin errores de accesibilidad", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <TeamSizeEstimate plans={CATALOGO_PUBLICADO} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Profesional: $59.900 al mes")).toBeVisible();

    const campo = screen.getByRole("spinbutton", {
      name: "Personas en el despacho",
    });
    await user.clear(campo);
    await user.type(campo, "30");

    expect(screen.getByText("Firma: $447.900 al mes")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "pedir una cotización" }),
    ).toHaveAttribute("href", "/empresa#cotizar");
    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});
