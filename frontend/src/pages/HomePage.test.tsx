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
        name: "ALETHEIA preserva y documenta. La valoración es del juez.",
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
      "Cómo se sabe que nadie alteró el archivo",
      "ALETHEIA preserva y documenta. La valoración es del juez.",
      "La contraparte podrá comprobar el paquete sin una cuenta",
      "Las mismas garantías en todos los planes",
      "Antes de empezar",
      "Pruebe ALETHEIA con uno de sus casos",
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
    // Los datos de ejemplo de toda la página no llevan la etiqueta de ficticios ni de ejemplo.
    expect(screen.getByRole("main").textContent).not.toMatch(
      /ficticios|datos de ejemplo/i,
    );
  });

  it("ninguna parte de la página afirma que la cadena registre quién abre o consulta un archivo", async () => {
    // La lista cerrada de acciones de custodia (custodyActions.ts) no tiene un evento de
    // apertura ni de consulta: la portada no puede decir que se registran.
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const { container } = await renderRoute("/");

    // Toda la página: el texto del encabezado, de cada sección (también las respuestas cerradas
    // de las preguntas frecuentes) y del pie, más las descripciones para lectores de pantalla.
    await screen.findByText(/^\$59\.900/);
    const texts = [
      container.textContent ?? "",
      ...Array.from(
        container.querySelectorAll("[aria-label]"),
        (element) => element.getAttribute("aria-label") ?? "",
      ),
    ].join(" ");
    // Lista explícita de formas: abrir como evento registrado (abre, abrió, abrir, abierto,
    // apertura), acceso, consulta, ver y visualizar. Las palabras se comparan enteras, así que
    // «abril», «previo» o «abrecartas» no cuentan.
    // «Abrir un caso» es el nombre de la acción de crear un caso en la aplicación (aparece en la
    // imagen del espacio de trabajo), no un evento de apertura de un archivo: se quita antes.
    expect(texts.replaceAll(/Abrir un caso/g, "")).not.toMatch(
      /(?<!\p{L})(abre|abren|abri[óo]|abrieron|abrir|abierto|abierta|aperturas?|accesos?|accedi[óo]|consult\p{L}*|vio|vieron|visualiz\p{L}*)(?!\p{L})/iu,
    );
  });

  it("el verificador no enlaza a una página que aún no existe y el cierre tiene una sola acción", async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    const { container } = await renderRoute("/");

    // HU-026 llega con la versión 1.0: hasta entonces ningún enlace lleva a /verificador.
    expect(container.querySelector("a[href='/verificador']")).toBeNull();
    const verifier = container.querySelector("#verificador")!;
    expect(within(verifier as HTMLElement).queryAllByRole("link")).toEqual([]);
    expect(verifier).toHaveTextContent(
      "El verificador público llega con la versión 1.0 de ALETHEIA.",
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
