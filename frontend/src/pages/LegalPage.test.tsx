import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION } from "../config/legal.ts";
import { LEGAL_PAGES, legalRoute } from "../config/routes.ts";
import { LEGAL_DOCUMENTS } from "../features/legal/documents.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { CATALOG } from "../test/plans.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Páginas legales (HU-003, CP-003)", () => {
  it.each(LEGAL_PAGES)(
    "publica $label con versión y fecha, sin cuenta ni llamadas a la API (CA-HU-003-01)",
    async ({ slug }) => {
      const legalDocument = LEGAL_DOCUMENTS[slug];
      const { container } = renderRoute(legalRoute(slug));

      const main = screen.getByRole("main");
      expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(
        1,
      );
      expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(
        legalDocument.title,
      );
      expect(within(main).getByText(`Versión ${LEGAL_VERSION}`)).toBeVisible();
      expect(within(main).getByText("2 de noviembre de 2026")).toHaveAttribute(
        "datetime",
        LEGAL_EFFECTIVE_DATE,
      );
      // Cada política cierra con los datos del responsable (Decreto 1074 de 2015).
      expect(
        within(main).getByRole("heading", {
          level: 2,
          name: "Responsable y contacto",
        }),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await seriousAxeViolations(container)).toEqual([]);
    },
  );

  it("se abren desde el pie de la página de inicio y de cada política (CA-HU-003-02)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    renderRoute("/");

    for (const page of LEGAL_PAGES) {
      const footerLegal = screen.getByRole("navigation", { name: "Legal" });
      await user.click(
        within(footerLegal).getByRole("link", { name: page.label }),
      );
      expect(
        await screen.findByRole("heading", {
          level: 1,
          name: LEGAL_DOCUMENTS[page.slug].title,
        }),
      ).toBeInTheDocument();
    }
  });

  it("cambia de política y marca la actual", async () => {
    const user = userEvent.setup();
    renderRoute(legalRoute("privacidad"));

    const switcher = screen.getByRole("navigation", { name: "Políticas" });
    expect(
      within(switcher).getByRole("link", { name: "Privacidad" }),
    ).toHaveAttribute("aria-current", "page");

    await user.click(
      within(switcher).getByRole("link", { name: "Reembolsos" }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Política de reembolsos y cancelación",
      }),
    ).toBeInTheDocument();
    // La política nueva monta su propio selector: se vuelve a buscar.
    const current = screen.getByRole("navigation", { name: "Políticas" });
    expect(
      within(current).getByRole("link", { name: "Reembolsos" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(current).getByRole("link", { name: "Privacidad" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("el índice lleva a cada apartado de la política", () => {
    const { container } = renderRoute(legalRoute("terminos"));

    const index = screen.getByRole("navigation", { name: "En esta página" });
    const links = within(index).getAllByRole("link");
    expect(links).toHaveLength(LEGAL_DOCUMENTS.terminos.sections.length + 1);
    for (const link of links) {
      const target = container.querySelector(link.getAttribute("href")!);
      expect(target).not.toBeNull();
      // El enlace dice lo mismo que el título del apartado al que lleva.
      expect(
        within(target as HTMLElement).getByRole("heading", { level: 2 }),
      ).toHaveTextContent(link.textContent!);
    }
  });

  it("pliega el índice en pantallas angostas e imprime la política", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    renderRoute(legalRoute("cookies"));

    const toggle = screen.getByRole("button", { name: "Ver el índice" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Ocultar el índice");

    await user.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("muestra la página no encontrada si la política no existe", () => {
    renderRoute("/legal/garantias");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "No encontramos esta página",
      }),
    ).toBeInTheDocument();
  });
});
