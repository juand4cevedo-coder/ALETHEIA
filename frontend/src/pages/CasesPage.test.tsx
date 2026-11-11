import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

type Role = "owner" | "admin" | "lawyer" | "assistant";

const ASSISTANT_EMPTY =
  "Los casos los abre un abogado, el administrador o el propietario. Cuando lo asignen a uno, aparecerá aquí";

function me(role: Role, emailVerified = true) {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8057",
    full_name: "Laura Gómez",
    email: "laura@example.com",
    email_verified: emailVerified,
    organization: {
      id: "01890a5d-ac96-774b-bcce-b302099a8058",
      name: "Ruiz & Asociados",
      role,
    },
    legal: {
      accepted_version: LEGAL_VERSION,
      current_version: LEGAL_VERSION,
      acceptance_required: false,
    },
  };
}

function summary(overrides: Record<string, unknown>) {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8090",
    title: "Despido sin justa causa, Torres",
    filing_number: "11001310500320260014300",
    court: "Juzgado 3 Laboral del Circuito de Bogotá",
    practice_area: "labor",
    internal_reference: null,
    status: "open",
    created_at: "2026-11-03T15:00:00Z",
    created_by_name: "Laura Gómez",
    member_count: 2,
    evidence_count: 12,
    evidence_by_type: { audio: 2, chat: 9, document: 1 },
    member_initials: ["LG", "AR"],
    last_event: {
      action: "evidence_downloaded",
      actor_name: "Laura Gómez",
      occurred_at: "2026-11-10T14:05:00Z",
    },
    recent_actions: [
      "evidence_uploaded",
      "evidence_stamped",
      "evidence_downloaded",
    ],
    last_activity_at: "2026-11-10T14:05:00Z",
    ...overrides,
  };
}

const TORRES = summary({});
const GOMEZ = summary({
  id: "01890a5d-ac96-774b-bcce-b302099a8091",
  title: "Sucesión Gómez Pardo",
  filing_number: "05001311001220260038800",
  court: "Juzgado 12 de Familia de Medellín",
  practice_area: "family",
  evidence_count: 4,
  evidence_by_type: { document: 3, image: 1 },
  recent_actions: ["case_created", "evidence_uploaded"],
});
const CONTRERAS = summary({
  id: "01890a5d-ac96-774b-bcce-b302099a8092",
  title: "Acoso laboral, Contreras (prejudicial)",
  filing_number: null,
  court: null,
  internal_reference: "RA-2026-031",
  evidence_count: 0,
  evidence_by_type: {},
  last_event: null,
  recent_actions: [],
});
const ARCHIVED = summary({
  id: "01890a5d-ac96-774b-bcce-b302099a8093",
  title: "Restitución de inmueble, Ortiz",
  status: "closed",
});

const TOTALS = {
  open: 3,
  closed: 1,
  evidences: 16,
  pending_stamps: 1,
  custody_events: 186,
};

type Page = { items: unknown[]; next_cursor: string | null; totals: unknown };

const EMPTY: Page = {
  items: [],
  next_cursor: null,
  totals: {
    open: 0,
    closed: 0,
    evidences: 0,
    pending_stamps: 0,
    custody_events: 0,
  },
};

function serve(
  role: Role,
  pages: (query: URLSearchParams) => Page,
  emailVerified = true,
) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    if (url.pathname === "/api/v1/me") {
      return jsonResponse(me(role, emailVerified));
    }
    if (request.method === "GET" && url.pathname === "/api/v1/cases") {
      return jsonResponse(pages(url.searchParams));
    }
    throw new Error(`Ruta inesperada: ${request.method} ${url.pathname}`);
  });
}

/** Peticiones de la lista del libro: la del conteo del menú pide un solo caso. */
function bookRequests(): URLSearchParams[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL((input as Request).url))
    .filter(
      (url) =>
        url.pathname === "/api/v1/cases" &&
        url.searchParams.get("limit") !== "1",
    )
    .map((url) => url.searchParams);
}

const BOOK: Page = {
  items: [TORRES, GOMEZ, CONTRERAS],
  next_cursor: null,
  totals: TOTALS,
};

async function openBook() {
  const rendered = await renderRoute("/app/casos");
  await screen.findByRole("heading", { level: 1, name: "Casos" });
  return rendered;
}

beforeEach(() => {
  fetchMock.mockReset();
  // Cada prueba empieza en pantalla ancha: jsdom no tiene matchMedia.
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Libro de casos (HU-017)", () => {
  it("sin casos muestra «Todavía no tiene casos» y el botón para abrir el primero", async () => {
    serve("lawyer", () => EMPTY);
    const user = userEvent.setup();
    const { router } = await openBook();

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Todavía no tiene casos.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("link", { name: "Abrir mi primer caso" }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/app/casos/nuevo"),
    );
  });

  it("antes del primer caso no promete lo que aún no existe", async () => {
    serve("lawyer", () => EMPTY);
    await openBook();
    await screen.findByRole("link", { name: "Abrir mi primer caso" });

    // Lo que ya ocurre se dice en presente; lo de la evidencia, que aún no se sube, en futuro.
    expect(
      screen.getByText(
        "Cada caso recibe su propia llave de cifrado al abrirse.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText((text) =>
        text.startsWith(
          "La evidencia que suba se guardará tal como llegó, cifrada con la llave del caso.",
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText((text) =>
        text.startsWith(
          "Cada acción sobre el caso queda en su cadena de custodia",
        ),
      ),
    ).toBeInTheDocument();
    // Ni eliminar casos ni destruir llaves existe todavía.
    expect(document.body).not.toHaveTextContent(/elimin|destru|ilegible/i);
    expect(document.body).not.toHaveTextContent(/Guardamos/);
  });

  it("un asistente sin casos ve el texto para asistentes y no ve el botón", async () => {
    serve("assistant", () => EMPTY);
    await openBook();

    expect(
      await screen.findByText((text) => text.includes(ASSISTANT_EMPTY)),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Abrir/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Abrir/ }),
    ).not.toBeInTheDocument();
  });

  it("un asistente con casos los ve sin el botón «Abrir un caso»", async () => {
    serve("assistant", () => BOOK);
    await openBook();

    await screen.findByRole("table");
    expect(
      screen.queryByRole("link", { name: "Abrir un caso" }),
    ).not.toBeInTheDocument();
  });

  it.each(["owner", "admin", "lawyer"] as const)(
    "un %s ve «Abrir un caso» y lleva al formulario",
    async (role) => {
      serve(role, () => BOOK);
      const user = userEvent.setup();
      const { router } = await openBook();

      await user.click(
        await screen.findByRole("link", { name: "Abrir un caso" }),
      );
      await waitFor(() =>
        expect(router.state.location.pathname).toBe("/app/casos/nuevo"),
      );
    },
  );

  it("con el correo sin verificar, «Abrir un caso» abre el aviso", async () => {
    serve("lawyer", () => BOOK, false);
    const user = userEvent.setup();
    const { router } = await openBook();

    await user.click(
      await screen.findByRole("button", { name: "Abrir un caso" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Verifique su correo" });
    expect(dialog).toHaveTextContent(
      "Verifique su correo para abrir casos. Le enviamos un enlace al crear la cuenta; si venció, pida uno nuevo.",
    );
    expect(router.state.location.pathname).toBe("/app/casos");
  });

  it("muestra la franja con los totales y la integridad «Sin verificar»", async () => {
    serve("lawyer", () => BOOK);
    const { container } = await openBook();

    const strip = await screen.findByRole("region", {
      name: "Estado de la custodia",
    });
    expect(within(strip).getByText("Sin verificar")).toBeInTheDocument();
    expect(strip).toHaveTextContent(/Evidencias preservadas\s*16/);
    expect(strip).toHaveTextContent(/Sellos de tiempo pendientes\s*1/);
    expect(strip).toHaveTextContent(/Eventos de custodia\s*186/);
    // Nada afirma una integridad que el verificador independiente no ha comprobado (HU-024).
    expect(container).not.toHaveTextContent(/íntegra/i);
    expect(container.querySelector("[data-tone='ok']")).toBeNull();

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(within(row).getByText("Sin verificar")).toBeInTheDocument();
    }
  });

  it("cada fila muestra el radicado por bloques o «Sin radicado, referencia interna»", async () => {
    serve("lawyer", () => BOOK);
    await openBook();

    const table = await screen.findByRole("table", { name: /Casos abiertos/ });
    const [torres, gomez, contreras] = within(table)
      .getAllByRole("row")
      .slice(1);

    const filing = within(torres!).getByText("11001 31 05 003 2026 00143 00");
    expect(filing).toHaveAttribute("translate", "no");
    expect(
      within(gomez!).getByText("05001 31 10 012 2026 00388 00"),
    ).toBeInTheDocument();
    expect(contreras).toHaveTextContent(
      "Sin radicado, referencia interna RA-2026-031",
    );
    expect(contreras).toHaveTextContent("Sin actividad registrada");
    expect(contreras).toHaveTextContent("Aún sin despacho");

    // El título es el enlace al caso.
    const link = within(torres!).getByRole("link", {
      name: "Despido sin justa causa, Torres",
    });
    expect(link).toHaveAttribute("href", `/app/casos/${TORRES.id}`);
    expect(within(torres!).getAllByRole("link")).toHaveLength(1);
    expect(torres).toHaveTextContent("9 chats, 2 audios, 1 documento");
    expect(gomez).toHaveTextContent("3 documentos, 1 imagen");

    // La cadena: un sello pendiente se ve y se dice.
    expect(
      within(gomez!).getByRole("img", {
        name: "Últimos 2 eventos: Caso creado, Evidencia subida (sello de tiempo pendiente)",
      }),
    ).toBeInTheDocument();
  });

  it("el segmento Cerrados vuelve a pedir la lista con status=closed", async () => {
    serve("lawyer", (query) =>
      query.get("status") === "closed"
        ? { items: [ARCHIVED], next_cursor: null, totals: TOTALS }
        : BOOK,
    );
    const user = userEvent.setup();
    await openBook();

    const segments = await screen.findByRole("radiogroup", {
      name: "Estado de los casos",
    });
    // El conteo visible no se pega al nombre: se lee «Abiertos, 3 casos», no «Abiertos3».
    const open = within(segments).getByRole("radio", {
      name: "Abiertos, 3 casos",
    });
    expect(open).toBeChecked();
    expect(open.closest("label")).toHaveTextContent("3");
    const closed = within(segments).getByRole("radio", {
      name: "Cerrados, 1 caso",
    });
    expect(closed.closest("label")).toHaveTextContent("1");
    expect(
      within(segments).getByRole("radio", { name: "Todos, 4 casos" }),
    ).toBeInTheDocument();

    await user.click(closed);

    const table = await screen.findByRole("table", { name: /Casos cerrados/ });
    expect(
      await within(table).findByText("Restitución de inmueble, Ortiz"),
    ).toBeInTheDocument();
    expect(bookRequests().map((query) => query.get("status"))).toEqual([
      "open",
      "closed",
    ]);
  });

  it("el segmento queda en la dirección y se conserva al volver de un caso", async () => {
    serve("lawyer", (query) =>
      query.get("status") === "all"
        ? { items: [TORRES, ARCHIVED], next_cursor: null, totals: TOTALS }
        : BOOK,
    );
    const user = userEvent.setup();
    const { router } = await openBook();

    await user.click(
      await screen.findByRole("radio", { name: "Todos, 4 casos" }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toBe("?estado=todos"),
    );
    await screen.findByRole("table", { name: /Todos los casos/ });

    await router.navigate("/app/casos/01890a5d-ac96-774b-bcce-b302099a8090");
    await router.navigate(-1);

    expect(
      await screen.findByRole("radio", { name: "Todos, 4 casos" }),
    ).toBeChecked();
    expect(router.state.location.search).toBe("?estado=todos");
  });

  it("la dirección elige el segmento", async () => {
    serve("lawyer", (query) =>
      query.get("status") === "closed"
        ? { items: [ARCHIVED], next_cursor: null, totals: TOTALS }
        : BOOK,
    );
    await renderRoute("/app/casos?estado=cerrados");

    expect(
      await screen.findByRole("radio", { name: "Cerrados, 1 caso" }),
    ).toBeChecked();
    expect(
      await screen.findByRole("table", { name: /Casos cerrados/ }),
    ).toBeInTheDocument();
    expect(bookRequests().map((query) => query.get("status"))).toEqual([
      "closed",
    ]);
  });

  it("un estado desconocido en la dirección muestra los abiertos", async () => {
    serve("lawyer", () => BOOK);
    await renderRoute("/app/casos?estado=archivados");

    expect(
      await screen.findByRole("radio", { name: "Abiertos, 3 casos" }),
    ).toBeChecked();
    await screen.findByRole("table", { name: /Casos abiertos/ });
    expect(bookRequests().map((query) => query.get("status"))).toEqual([
      "open",
    ]);
  });

  it("el campo de texto filtra por título, radicado o despacho sin pedir nada a la API", async () => {
    serve("lawyer", () => BOOK);
    const user = userEvent.setup();
    await openBook();
    const table = await screen.findByRole("table");
    const requests = fetchMock.mock.calls.length;
    const filter = screen.getByRole("searchbox", { name: /Filtrar/ });

    await user.type(filter, "sucesion");
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(1);
    expect(within(table).getByText("Sucesión Gómez Pardo")).toBeInTheDocument();

    await user.clear(filter);
    await user.type(filter, "2026 00143");
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(1);
    expect(
      within(table).getByText("Despido sin justa causa, Torres"),
    ).toBeInTheDocument();

    await user.clear(filter);
    await user.type(filter, "medellín");
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(1);

    await user.clear(filter);
    await user.type(filter, "nada que ver");
    expect(
      screen.getByText(/Ningún caso cargado coincide/),
    ).toBeInTheDocument();

    expect(fetchMock.mock.calls.length).toBe(requests);
  });

  it("«Cargar más casos» pide la página siguiente y anuncia cuántos llegaron", async () => {
    serve("lawyer", (query) =>
      query.get("cursor") === "c2"
        ? { items: [CONTRERAS], next_cursor: null, totals: TOTALS }
        : { items: [TORRES, GOMEZ], next_cursor: "c2", totals: TOTALS },
    );
    const user = userEvent.setup();
    await openBook();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Cargar más casos" }));

    await waitFor(() =>
      expect(within(table).getAllByRole("row").slice(1)).toHaveLength(3),
    );
    expect(
      screen.getByText("Se cargó 1 caso más; 3 en total."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cargar más casos" }),
    ).not.toBeInTheDocument();
    expect(bookRequests().at(-1)?.get("cursor")).toBe("c2");
    // El botón desapareció: el foco pasa al primer caso nuevo.
    expect(
      within(table).getByRole("link", { name: CONTRERAS.title as string }),
    ).toHaveFocus();
  });

  it("cada carga de una página completa se anuncia con un texto distinto", async () => {
    const page = (cursor: string, next: string | null) => ({
      items: Array.from({ length: 25 }, (_, index) =>
        summary({
          id: `01890a5d-ac96-774b-bcce-${cursor}${String(index).padStart(10, "0")}`,
          title: `Caso ${cursor} ${index}`,
        }),
      ),
      next_cursor: next,
      totals: { ...TOTALS, open: 75 },
    });
    serve("lawyer", (query) => {
      const cursor = query.get("cursor");
      if (cursor === "c2") return page("c2", "c3");
      if (cursor === "c3") return page("c3", null);
      return page("c1", "c2");
    });
    const user = userEvent.setup();
    await openBook();
    const table = await screen.findByRole("table");
    const status = () =>
      screen
        .getAllByRole("status")
        .find((region) => region.textContent?.startsWith("Se carg"));

    await user.click(screen.getByRole("button", { name: "Cargar más casos" }));
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "Se cargaron 25 casos más; 50 en total.",
      ),
    );

    await user.click(screen.getByRole("button", { name: "Cargar más casos" }));
    await waitFor(() =>
      expect(status()).toHaveTextContent(
        "Se cargaron 25 casos más; 75 en total.",
      ),
    );
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(75);
  });

  it("con el filtro activo anuncia la carga y las coincidencias, y el foco no se pierde", async () => {
    serve("lawyer", (query) =>
      query.get("cursor") === "c2"
        ? { items: [CONTRERAS], next_cursor: null, totals: TOTALS }
        : { items: [TORRES, GOMEZ], next_cursor: "c2", totals: TOTALS },
    );
    const user = userEvent.setup();
    await openBook();
    const table = await screen.findByRole("table");
    await user.type(
      screen.getByRole("searchbox", { name: /Filtrar/ }),
      "torres",
    );

    await user.click(screen.getByRole("button", { name: "Cargar más casos" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Se cargó 1 caso más; 3 en total. 1 de 3 casos cargados coincide.",
        ),
      ).toBeInTheDocument(),
    );
    // El caso nuevo no coincide con el filtro: el foco va a la tabla, no se pierde.
    expect(table).toHaveFocus();
  });

  it("en 900 px o menos las filas pasan a tarjetas", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            matches: query === "(max-width: 900px)",
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      ),
    );
    serve("lawyer", () => BOOK);
    await openBook();

    const list = await screen.findByRole("list", { name: /Casos abiertos/ });
    expect(list).toHaveAttribute("data-layout", "cards");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const cards = within(list).getAllByRole("article");
    expect(cards).toHaveLength(3);
    expect(
      within(cards[0]!).getByRole("link", {
        name: "Despido sin justa causa, Torres",
      }),
    ).toBeInTheDocument();
    expect(cards[0]).toHaveAccessibleName("Despido sin justa causa, Torres");
  });

  it("el menú lateral lleva a Casos con el conteo de abiertos", async () => {
    serve("owner", () => BOOK);
    await renderRoute("/app");

    const nav = await screen.findByRole("navigation", {
      name: "Espacio de trabajo",
    });
    const casos = await within(nav).findByRole("link", { name: /^Casos/ });
    expect(casos).toHaveAttribute("href", "/app/casos");
    await waitFor(() => expect(casos).toHaveTextContent("3"));
    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent?.match(/^[^\d,]+/)?.[0]);
    expect(labels.slice(0, 3)).toEqual(["Inicio", "Casos", "Miembros"]);
    expect(casos).toHaveAccessibleName("Casos, 3 abiertos");
  });

  it("sin violaciones de axe", async () => {
    serve("lawyer", () => ({ ...BOOK, next_cursor: "c2" }));
    const { container } = await openBook();
    await screen.findByRole("table");

    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("sin violaciones de axe antes del primer caso", async () => {
    serve("lawyer", () => EMPTY);
    const { container } = await openBook();
    await screen.findByRole("link", { name: "Abrir mi primer caso" });

    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});
