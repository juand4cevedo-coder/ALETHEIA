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
    await renderRoute("/");

    const main = screen.getByRole("main");
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Demuestre que el archivo que aporta no cambió desde que lo preservó.",
    );
    expect(
      within(main).getByRole("heading", {
        level: 2,
        name: "Lo que pasa con su archivo desde que lo sube",
      }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", {
        level: 2,
        name: "Preservamos y documentamos. La valoración es del juez.",
      }),
    ).toBeInTheDocument();
    expect(
      within(main).getByText(
        "No certificamos pruebas ni determinamos su validez.",
      ),
    ).toBeInTheDocument();
    expect(
      within(main).getAllByRole("link", { name: "Crear una cuenta" })[0],
    ).toHaveAttribute("href", "/registro");
  });

  it("muestra los planes y los días de prueba desde el catálogo", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    await renderRoute("/");

    expect(await screen.findByText(/^\$59\.900/)).toBeInTheDocument();
    expect(screen.getByText("Recomendado")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Pedir una cotización/ }),
    ).toHaveAttribute("href", expect.stringContaining("mailto:"));
    expect(
      screen.getByText("14 días de prueba gratuita, sin tarjeta de crédito."),
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
    await renderRoute("/");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "No pudimos cargar los precios en este momento.",
    );
    await user.click(
      within(alert).getByRole("button", {
        name: "Cargar los precios de nuevo",
      }),
    );

    expect(await screen.findByText(/^\$59\.900/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("se recorre con el teclado y no tiene errores graves de accesibilidad (CA-HU-001-02)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    const { container } = await renderRoute("/");
    await screen.findByText(/^\$59\.900/);

    // Todo lo que se puede activar o editar fuera del menú móvil cerrado (incluido el texto de la
    // demostración de la huella), en orden del documento.
    const menu = container.querySelector("dialog");
    const interactive = Array.from(
      container.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), summary, textarea",
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

  it("los H2 de la landing siguen el orden de la especificación", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    await renderRoute("/");

    const headings = within(screen.getByRole("main")).getAllByRole("heading", {
      level: 2,
    });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Una captura de pantalla no es el archivo original",
      "Lo que pasa con su archivo desde que lo sube",
      "Garantías que cualquier perito puede comprobar",
      "Preservamos y documentamos. La valoración es del juez.",
      "¿Recibió un paquete de preservación?",
      "Las mismas garantías en todos los planes",
      "Lo que más nos preguntan",
      "Empiece a preservar su evidencia hoy",
    ]);
  });

  it("la imagen del espacio de trabajo dice el estado real de cada caso, sin verde", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const { container } = await renderRoute("/");

    // Es una imagen: los lectores de pantalla reciben su descripción y no la tabla.
    const shot = screen.getByRole("img", {
      name: /^Vista del espacio de trabajo/,
    });
    expect(shot.querySelector("table")).not.toBeNull();
    expect(within(shot).getAllByText("Sin verificar").length).toBeGreaterThan(
      0,
    );
    expect(within(shot).getByText("Sellando")).toBeInTheDocument();
    // El verde es solo para lo que el sistema verificó: ninguna insignia de la portada lo usa.
    expect(container.querySelector("[data-tone='ok']")).toBeNull();
    // Los datos de ejemplo del inicio y de Cómo funciona no llevan la etiqueta de ficticios.
    for (const id of ["titulo-inicio", "titulo-como-funciona"]) {
      const region = container.querySelector(`[aria-labelledby='${id}']`)!;
      expect(region.textContent).not.toMatch(/ficticios/i);
    }
  });

  it("no afirma que la cadena registre quién abre o consulta un archivo", async () => {
    // La lista cerrada de acciones de custodia (custodyActions.ts) no tiene un evento de
    // apertura ni de consulta: la portada no puede decir que se registran.
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const { container } = await renderRoute("/");

    const texts = [
      ...Array.from(
        container.querySelectorAll(
          "[aria-labelledby='titulo-inicio'], [aria-labelledby='titulo-problema'], [aria-labelledby='titulo-como-funciona'], footer",
        ),
        (element) => element.textContent ?? "",
      ),
      screen
        .getByRole("img", { name: /^Vista del espacio de trabajo/ })
        .getAttribute("aria-label") ?? "",
    ].join(" ");
    expect(texts).not.toMatch(
      /(?<!\p{L})(abre|abri[óo]|accesos?|consult\p{L}*|vio|visualiz\p{L}*)(?!\p{L})/iu,
    );
  });

  it("cada enlace de la navegación lleva a una sección o página que existe", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    await renderRoute("/");

    const nav = screen.getByRole("navigation", { name: "Principal" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Producto",
      "Seguridad",
      "Precios",
      "Verificar",
    ]);
    for (const link of links) {
      const href = link.getAttribute("href")!;
      const [, hash] = href.split("#");
      if (hash) expect(document.getElementById(hash)).not.toBeNull();
      else expect(href).toBe("/precios");
    }
  });

  it("abre y cierra las preguntas frecuentes", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    await renderRoute("/");

    const question = screen.getByText("¿Qué es una huella SHA-256?");
    const details = question.closest("details")!;
    expect(details).not.toHaveAttribute("open");
    await user.click(question);
    expect(details).toHaveAttribute("open");
  });

  it("abre el menú móvil como diálogo y lo cierra al elegir un enlace", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    await renderRoute("/");

    const menuButton = screen.getByRole("button", { name: "Menú" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await user.click(menuButton);

    const dialog = screen.getByRole("dialog", { name: "Menú" });
    expect(dialog).toHaveAttribute("open");
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await user.click(within(dialog).getByRole("link", { name: "Precios" }));
    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
    expect(
      // El chunk de la página se carga aparte: en jsdom tarda más del 1 s predeterminado.
      await screen.findByRole(
        "heading",
        {
          level: 1,
          name: "Planes y precios",
        },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
  });
});

describe("Encabezado con sesión abierta (Diseño UX/UI, 4.2)", () => {
  it("sin sesión ofrece ingresar", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    await renderRoute("/");

    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("link", { name: "Ingresar" }),
    ).toHaveAttribute("href", "/ingresar");
  });

  it("con sesión cambia «Ingresar» por «Ir a mis casos»", async () => {
    window.localStorage.setItem("aletheia:sesion", "1");
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    await renderRoute("/");

    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("link", { name: "Ir a mis casos" }),
    ).toHaveAttribute("href", "/app");
    expect(
      within(header).queryByRole("link", { name: "Ingresar" }),
    ).not.toBeInTheDocument();
  });
});
