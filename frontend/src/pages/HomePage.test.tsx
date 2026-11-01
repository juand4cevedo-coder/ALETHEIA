import { screen, waitFor, within } from "@testing-library/react";
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

describe("Página de inicio (HU-001)", () => {
  it("explica qué hace ALETHEIA y aclara que no certifica pruebas (CA-HU-001-01)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    renderRoute("/");

    const main = screen.getByRole("main");
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Preserve la evidencia digital tal como la recibió.",
    );
    expect(
      within(main).getByRole("heading", {
        level: 2,
        name: "De la recepción del archivo al expediente, en cuatro pasos",
      }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", {
        level: 2,
        name: "Preservamos y documentamos. La valoración es del juez.",
      }),
    ).toBeInTheDocument();
    expect(
      within(main).getByText("No certifica pruebas ni determina su validez."),
    ).toBeInTheDocument();
    expect(
      within(main).getAllByRole("link", { name: "Crear cuenta gratis" })[0],
    ).toHaveAttribute("href", "/registro");
  });

  it("muestra los planes y los días de prueba desde el catálogo", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    renderRoute("/");

    expect(await screen.findByText(/^\$59\.900/)).toBeInTheDocument();
    expect(screen.getByText("Recomendado")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Solicitar cotización/ }),
    ).toHaveAttribute("href", expect.stringContaining("mailto:"));
    expect(
      screen.getByText("14 días de prueba gratuita · Sin tarjeta de crédito"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si el catálogo no responde, avisa y permite reintentar", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            type: "about:blank",
            title: "Service Unavailable",
            status: 503,
          },
          503,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(CATALOG));
    const user = userEvent.setup();
    renderRoute("/");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "No pudimos cargar los precios en este momento.",
    );
    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText(/^\$59\.900/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("se recorre con el teclado y no tiene errores graves de accesibilidad (CA-HU-001-02)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    const { container } = renderRoute("/");
    await screen.findByText(/^\$59\.900/);

    // Todo lo que se puede activar fuera del menú móvil cerrado, en orden del documento.
    const menu = container.querySelector("dialog");
    const interactive = Array.from(
      container.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), summary",
      ),
    ).filter((element) => !menu?.contains(element));

    const reached: Element[] = [];
    for (let step = 0; step < interactive.length; step += 1) {
      await user.tab();
      reached.push(document.activeElement!);
    }
    expect(reached[0]).toHaveTextContent("Saltar al contenido");
    expect(reached).toEqual(interactive);

    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("abre y cierra las preguntas frecuentes", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    renderRoute("/");

    const question = screen.getByText("¿Qué es una huella SHA-256?");
    const details = question.closest("details")!;
    expect(details).not.toHaveAttribute("open");
    await user.click(question);
    expect(details).toHaveAttribute("open");
  });

  it("abre el menú móvil como diálogo y lo cierra al elegir un enlace", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    renderRoute("/");

    const menuButton = screen.getByRole("button", { name: "Menú" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await user.click(menuButton);

    const dialog = screen.getByRole("dialog", { name: "Menú" });
    expect(dialog).toHaveAttribute("open");
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await user.click(within(dialog).getByRole("link", { name: "Precios" }));
    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Planes y precios",
      }),
    ).toBeInTheDocument();
  });
});
