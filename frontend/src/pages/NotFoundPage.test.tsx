import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { CONTACT_EMAIL } from "../config/site.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { renderRoute } from "../test/render.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";

function Broken(): never {
  throw new Error("Falló al pintar");
}

describe("Página no encontrada y página que falló", () => {
  it("una dirección que no existe dice cómo seguir y lleva al inicio", async () => {
    const { container } = await renderRoute("/no-existe");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "No encontramos esta página",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Volver al inicio" })[0],
    ).toHaveAttribute("href", "/");
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("si la página falla al mostrarse no dice que no existe: pide recargarla", async () => {
    // React informa en la consola el error que atrapa la ruta; aquí es el esperado.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const router = createMemoryRouter(
      [{ path: "/", element: <Broken />, errorElement: <NotFoundPage /> }],
      { initialEntries: ["/"] },
    );
    const { container } = render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "No pudimos mostrar esta página",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No encontramos esta página"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recargar la página" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: CONTACT_EMAIL })).toHaveAttribute(
      "href",
      `mailto:${CONTACT_EMAIL}`,
    );
    expect(await seriousAxeViolations(container)).toEqual([]);
    consoleError.mockRestore();
  });
});
