import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONSUMER_AUTHORITY,
  DATA_CONTROLLER,
  LEGAL_EFFECTIVE_DATE,
} from "../config/legal.ts";
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
    "publica $label con su fecha de vigencia, sin cuenta ni llamadas a la API (CA-HU-003-01)",
    async ({ slug }) => {
      const legalDocument = LEGAL_DOCUMENTS[slug];
      const { container } = await renderRoute(legalRoute(slug));

      const main = screen.getByRole("main");
      expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(
        1,
      );
      expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(
        legalDocument.title,
      );
      // Los textos se identifican por su vigencia: ninguna página muestra un número de versión.
      expect(within(main).queryByText(/versión\s*\d/i)).not.toBeInTheDocument();
      expect(within(main).getByText("6 de noviembre de 2026")).toHaveAttribute(
        "datetime",
        LEGAL_EFFECTIVE_DATE,
      );
      // Cada política cierra con los datos del responsable (Decreto 1377 de 2013, art. 13) y
      // la identidad de quien vende en línea (Ley 1480 de 2011, art. 50, literal a).
      const contact = within(main)
        .getByRole("heading", { level: 2, name: "Responsable y contacto" })
        .closest("section")!;
      expect(contact).toHaveTextContent(DATA_CONTROLLER.nit);
      expect(contact).toHaveTextContent(DATA_CONTROLLER.address);
      expect(
        within(contact).getByRole("link", { name: CONSUMER_AUTHORITY.name }),
      ).toHaveAttribute("href", CONSUMER_AUTHORITY.url);
      // Lo esencial, en tarjetas, y la huella del texto, calculada en el navegador.
      expect(within(main).getAllByRole("listitem").length).toBeGreaterThan(0);
      expect(
        await within(main).findByText(/^[0-9a-f]{64}$/),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await seriousAxeViolations(container)).toEqual([]);
    },
  );

  it("se abren desde el pie de la página de inicio y de cada política (CA-HU-003-02)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    await renderRoute("/");

    // El pie identifica a quien vende y enlaza a la autoridad de protección al consumidor
    // (Ley 1480 de 2011, art. 50, literal a y parágrafo).
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(`NIT ${DATA_CONTROLLER.nit}`);
    expect(
      within(footer).getByRole("link", { name: CONSUMER_AUTHORITY.name }),
    ).toHaveAttribute("href", CONSUMER_AUTHORITY.url);

    for (const page of LEGAL_PAGES) {
      const footerLegal = screen.getByRole("navigation", { name: "Legal" });
      await user.click(
        within(footerLegal).getByRole("link", { name: page.label }),
      );
      expect(
        // El chunk de la página se carga aparte: en jsdom tarda más del 1 s predeterminado.
        await screen.findByRole(
          "heading",
          {
            level: 1,
            name: LEGAL_DOCUMENTS[page.slug].title,
          },
          { timeout: 5000 },
        ),
      ).toBeInTheDocument();
    }
  });

  it("cambia de política y marca la actual", async () => {
    const user = userEvent.setup();
    await renderRoute(legalRoute("privacidad"));

    const switcher = screen.getByRole("navigation", { name: "Políticas" });
    expect(
      within(switcher).getByRole("link", { name: "Privacidad" }),
    ).toHaveAttribute("aria-current", "page");

    await user.click(
      within(switcher).getByRole("link", { name: "Reembolsos" }),
    );
    expect(
      // El chunk de la página se carga aparte: en jsdom tarda más del 1 s predeterminado.
      await screen.findByRole(
        "heading",
        {
          level: 1,
          name: "Política de reembolsos y cancelación",
        },
        { timeout: 5000 },
      ),
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

  it("el índice lleva a cada apartado de la política", async () => {
    const { container } = await renderRoute(legalRoute("terminos"));

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

  it("descarga el texto vigente con la misma huella que muestra (Ley 1480, art. 50 d)", async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:texto");
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    await renderRoute(legalRoute("terminos"));

    const hash = (await screen.findByText(/^[0-9a-f]{64}$/)).textContent;
    await user.click(
      screen.getByRole("button", { name: "Descargar el texto" }),
    );

    expect(click).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("text/plain;charset=utf-8");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Cualquiera puede comprobarlo: la SHA-256 del archivo es la huella de la página.
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    expect(
      Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
    ).toBe(hash);

    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith("TÉRMINOS Y CONDICIONES\n")).toBe(true);
    expect(text).toContain("Vigente desde el 6 de noviembre de 2026");
    for (const section of LEGAL_DOCUMENTS.terminos.sections) {
      expect(text).toContain(section.title.toUpperCase());
    }
    expect(text).toContain(`NIT:\n${DATA_CONTROLLER.nit}`);
    expect(text).toContain("Fundamento: Ley 1480 de 2011, art. 50, literal a");
    click.mockRestore();
  });

  it("pliega el índice en pantallas angostas e imprime la política", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderRoute(legalRoute("cookies"));

    const toggle = screen.getByRole("button", { name: "Ver el índice" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Ocultar el índice");

    await user.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("muestra la página no encontrada si la política no existe", async () => {
    await renderRoute("/legal/garantias");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "No encontramos esta página",
      }),
    ).toBeInTheDocument();
  });
});
