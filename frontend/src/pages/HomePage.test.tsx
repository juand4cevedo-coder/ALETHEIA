import { matchRoutes } from "react-router";
import { routes } from "../routes/router.tsx";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SIGN_UP_LABEL } from "../config/site.ts";
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
      /Su trabajo\.\s*Con claridad\./,
    );
    expect(
      within(main).getByRole("heading", {
        level: 2,
        name: "Un poco de orden. Mucho más espacio para pensar.",
      }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", {
        level: 2,
        name: "Una herramienta precisa. Un alcance claro.",
      }),
    ).toBeInTheDocument();
    expect(
      within(main).getByText(
        "No certifica pruebas ni decide sobre su validez.",
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
      screen.getByText(/La prueba dura 14 días y no pide tarjeta de crédito/),
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

    await user.tab();
    expect(document.activeElement).toHaveTextContent("Saltar al contenido");
    const trigger = within(
      screen.getByRole("navigation", { name: "Principal" }),
    ).getByRole("button", { name: "Producto" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("muestra la demostración técnica solo al solicitarla", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const user = userEvent.setup();
    await renderRoute("/");
    const question = await screen.findByText(
      "¿Cómo se detecta un cambio en un archivo?",
    );
    const field = screen.getByLabelText("Texto de ejemplo");
    expect(field).not.toBeVisible();
    await user.click(question);
    expect(field).toBeVisible();
    await user.click(question);
    expect(field).not.toBeVisible();
  });

  it("los H2 presentan contexto, organización, integridad, alcance y condiciones", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    await renderRoute("/");

    const headings = within(screen.getByRole("main")).getAllByRole("heading", {
      level: 2,
    });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Todo tiene su lugar.",
      "Un poco de orden. Mucho más espacio para pensar.",
      "Saber qué ocurre. Decidir quién participa.",
      "Una herramienta precisa. Un alcance claro.",
      "La confianza también se comprueba.",
      "Un espacio a la medida de su práctica.",
      "Antes de empezar",
      "Pruebe ALETHEIA con uno de sus casos",
    ]);
  });

  it("el comprobador funciona en la portada y el cierre tiene una sola acción", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const { container } = await renderRoute("/");

    // La comprobación local se abre en la sección, sin navegación a una ruta vacía.
    expect(container.querySelector("a[href='/verificador']")).toBeNull();
    const verifier = container.querySelector("#verificador")!;
    expect(within(verifier as HTMLElement).queryAllByRole("link")).toEqual([]);
    expect(verifier).toHaveTextContent(
      "El archivo permanece en su dispositivo.",
    );

    const closing = container.querySelector(
      "[aria-labelledby='titulo-cierre']",
    ) as HTMLElement;
    const actions = within(closing).getAllByRole("link");
    expect(actions).toHaveLength(1);
    expect(actions[0]).toHaveTextContent(SIGN_UP_LABEL);
    expect(actions[0]).toHaveAttribute("href", "/registro");
    expect(
      await within(closing).findByText(
        "Cree su cuenta y abra su primer caso. La prueba dura 14 días y no pide tarjeta de crédito.",
      ),
    ).toBeInTheDocument();
  });

  it("cada enlace de la navegación lleva a una sección o página que existe", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    await renderRoute("/");

    const nav = screen.getByRole("navigation", { name: "Principal" });
    const user = userEvent.setup();
    for (const trigger of within(nav).getAllByRole("button")) {
      await user.hover(trigger);
      for (const link of within(nav).getAllByRole("link")) {
        const href = link.getAttribute("href")!;
        const [path, hash] = href.split("#");
        const matches = matchRoutes(routes, path!);
        expect(matches, href).not.toBeNull();
        expect(matches?.at(-1)?.route.path, href).not.toBe("*");
        if (hash) expect(document.getElementById(hash), href).not.toBeNull();
      }
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

    // El primero es el del sitio. jsdom también cuenta como encabezado el de cada tarjeta de
    // plan, que llega con el catálogo.
    const [header] = screen.getAllByRole("banner");
    expect(
      within(header).getByRole("link", { name: "Ingresar" }),
    ).toHaveAttribute("href", "/ingresar");
  });

  it("con sesión cambia «Ingresar» por «Ir a mis casos»", async () => {
    window.localStorage.setItem("aletheia:sesion", "1");
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    await renderRoute("/");

    // El primero es el del sitio. jsdom también cuenta como encabezado el de cada tarjeta de
    // plan, que llega con el catálogo.
    const [header] = screen.getAllByRole("banner");
    expect(
      within(header).getByRole("link", { name: "Ir a mis casos" }),
    ).toHaveAttribute("href", "/app");
    expect(
      within(header).queryByRole("link", { name: "Ingresar" }),
    ).not.toBeInTheDocument();
  });
});
