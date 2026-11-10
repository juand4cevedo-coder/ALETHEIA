import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

type Role = "owner" | "admin" | "lawyer" | "assistant";

const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8090";
const RADICADO = "11001310500320260014300";
const FILING_NUMBER_TAKEN_PROBLEM =
  "https://aletheia.sbs/problemas/radicado-repetido";

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

const CREATED = {
  id: CASE_ID,
  title: "Despido sin justa causa · Torres",
  filing_number: RADICADO,
  court: null,
  practice_area: "labor",
  internal_reference: null,
  status: "open",
  created_at: "2026-11-10T15:00:00Z",
  created_by_name: "Laura Gómez",
  member_count: 1,
};

type Handler = (request: Request) => Response | Promise<Response>;

function serve(
  role: Role,
  routes: Record<string, Handler> = {},
  emailVerified = true,
) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    const key = `${request.method} ${path}`;
    if (routes[key]) return routes[key](request);
    if (path === "/api/v1/me") return jsonResponse(me(role, emailVerified));
    throw new Error(`Ruta inesperada: ${key}`);
  });
}

function posts(): Request[] {
  return fetchMock.mock.calls
    .map(([input]) => input as Request)
    .filter(
      (request) =>
        request.method === "POST" &&
        new URL(request.url).pathname === "/api/v1/cases",
    );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Abrir un caso (HU-015)", () => {
  it("abre el caso y lleva a su página", async () => {
    serve("lawyer", {
      "POST /api/v1/cases": () => jsonResponse(CREATED, 201),
    });
    const user = userEvent.setup();
    const { router } = await renderRoute("/app/casos/nuevo");

    await user.type(
      await screen.findByLabelText("Título del caso"),
      "  Despido sin justa causa · Torres ",
    );
    await user.type(
      screen.getByLabelText(/Número de radicación/),
      "11001-31-05-003-2026-00143-00",
    );
    await user.selectOptions(screen.getByLabelText(/Especialidad/), "labor");
    await user.click(screen.getByRole("button", { name: "Abrir caso" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/app/casos/${CASE_ID}`),
    );
    expect(router.state.location.state).toEqual({ justOpened: true });
    const [request] = posts();
    expect(await request!.json()).toEqual({
      title: "Despido sin justa causa · Torres",
      filing_number: RADICADO,
      practice_area: "labor",
    });
  });

  it("desglosa el radicado mientras se escribe y avisa si no tiene 23 dígitos", async () => {
    serve("owner");
    const user = userEvent.setup();
    await renderRoute("/app/casos/nuevo");

    const field = await screen.findByLabelText(/Número de radicación/);
    await user.type(field, "11001 31 05");
    const form = screen.getByRole("form", { name: "Abrir un caso" });
    const parts = within(form).getByRole("group", {
      name: "Partes del número de radicación",
    });
    expect(within(parts).getByText("001")).toBeInTheDocument();
    expect(within(parts).getByText("Ciudad")).toBeInTheDocument();
    expect(screen.getByText("Lleva 9 de 23 dígitos.")).toBeInTheDocument();

    await user.tab();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(
      expect.stringContaining(
        "El número de radicación tiene 23 dígitos. Revise que no falte ni sobre ninguno",
      ),
    );

    await user.clear(field);
    await user.type(field, RADICADO);
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText(/^23 dígitos\./)).toBeInTheDocument();
  });

  it("la vista previa muestra el título, el radicado y «Evento 1 · Caso creado»", async () => {
    serve("lawyer");
    const user = userEvent.setup();
    await renderRoute("/app/casos/nuevo");

    await user.type(
      await screen.findByLabelText("Título del caso"),
      "Sucesión Gómez Pardo",
    );
    await user.type(screen.getByLabelText(/Número de radicación/), RADICADO);
    await user.type(
      screen.getByLabelText(/Despacho/),
      "Juzgado 3 Laboral del Circuito de Bogotá",
    );

    const preview = screen.getByRole("region", {
      name: "Así quedará el registro de apertura",
    });
    expect(
      within(preview).getByRole("heading", { name: "Sucesión Gómez Pardo" }),
    ).toBeInTheDocument();
    expect(
      within(preview).getByText("CASO · 11001 31 05 003 2026 00143 00"),
    ).toBeInTheDocument();
    expect(
      within(preview).getByText("Juzgado 3 Laboral del Circuito de Bogotá"),
    ).toBeInTheDocument();
    expect(
      within(preview).getByText("Laura Gómez · Abogado"),
    ).toBeInTheDocument();
    expect(within(preview).getByText("Ruiz & Asociados")).toBeInTheDocument();
    expect(
      within(preview).getByText("Evento 1 · Caso creado"),
    ).toBeInTheDocument();
    expect(preview).not.toHaveTextContent(/certific|valida la prueba/i);
  });

  it("deshabilita el botón mientras se abre el caso", async () => {
    let release: (response: Response) => void = () => {};
    serve("owner", {
      "POST /api/v1/cases": () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });
    const user = userEvent.setup();
    await renderRoute("/app/casos/nuevo");

    await user.type(
      await screen.findByLabelText("Título del caso"),
      "Sucesión Gómez Pardo",
    );
    const button = screen.getByRole("button", { name: "Abrir caso" });
    await user.dblClick(button);

    const busy = await screen.findByRole("button", {
      name: "Abriendo el caso…",
    });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(posts()).toHaveLength(1);
    release(jsonResponse(CREATED, 201));
  });

  it("con un error de la API conserva lo escrito y enfoca el campo", async () => {
    serve("lawyer", {
      "POST /api/v1/cases": () =>
        jsonResponse(
          {
            type: FILING_NUMBER_TAKEN_PROBLEM,
            status: 409,
            detail:
              "Ya hay un caso con este número de radicación en su organización",
          },
          409,
        ),
    });
    const user = userEvent.setup();
    await renderRoute("/app/casos/nuevo");

    const title = await screen.findByLabelText("Título del caso");
    await user.type(title, "Sucesión Gómez Pardo");
    const filing = screen.getByLabelText(/Número de radicación/);
    await user.type(filing, RADICADO);
    await user.click(screen.getByRole("button", { name: "Abrir caso" }));

    await waitFor(() => expect(filing).toHaveFocus());
    expect(filing).toHaveAttribute("aria-invalid", "true");
    expect(filing).toHaveAccessibleDescription(
      expect.stringContaining(
        "Ya hay un caso con este número de radicación en su organización",
      ),
    );
    expect(title).toHaveValue("Sucesión Gómez Pardo");
    expect(filing).toHaveValue(RADICADO);
  });

  it("el 409 de solo lectura no se confunde con el radicado repetido", async () => {
    const readOnly =
      "Su organización está en solo lectura: puede consultar y exportar, pero no abrir casos hasta reactivar el plan.";
    serve("owner", {
      "POST /api/v1/cases": () =>
        jsonResponse(
          { type: "about:blank", status: 409, detail: readOnly },
          409,
        ),
    });
    const user = userEvent.setup();
    await renderRoute("/app/casos/nuevo");

    await user.type(
      await screen.findByLabelText("Título del caso"),
      "Sucesión Gómez Pardo",
    );
    const filing = screen.getByLabelText(/Número de radicación/);
    await user.type(filing, RADICADO);
    await user.click(screen.getByRole("button", { name: "Abrir caso" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(readOnly);
    expect(filing).not.toHaveAttribute("aria-invalid");
  });

  it("sin KMS explica que no se pudo preparar la llave", async () => {
    serve("owner", {
      "POST /api/v1/cases": () =>
        jsonResponse({ type: "about:blank", status: 503, detail: "KMS" }, 503),
    });
    const user = userEvent.setup();
    await renderRoute("/app/casos/nuevo");

    await user.type(
      await screen.findByLabelText("Título del caso"),
      "Sucesión Gómez Pardo",
    );
    await user.click(screen.getByRole("button", { name: "Abrir caso" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos preparar la llave de cifrado del caso. Inténtelo de nuevo en unos minutos",
    );
  });

  it("sin título no envía y enfoca el campo", async () => {
    serve("owner");
    const user = userEvent.setup();
    await renderRoute("/app/casos/nuevo");

    const title = await screen.findByLabelText("Título del caso");
    await user.type(title, "   ");
    await user.click(screen.getByRole("button", { name: "Abrir caso" }));

    expect(title).toHaveFocus();
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(posts()).toHaveLength(0);
  });

  it("con el correo sin verificar, el botón abre el aviso con «Verifique su correo para abrir casos»", async () => {
    serve("lawyer", {}, false);
    const user = userEvent.setup();
    await renderRoute("/app/casos/nuevo");

    await user.type(
      await screen.findByLabelText("Título del caso"),
      "Sucesión Gómez Pardo",
    );
    await user.click(screen.getByRole("button", { name: "Abrir caso" }));

    const dialog = screen.getByRole("dialog", { name: "Verifique su correo" });
    expect(dialog).toHaveTextContent(
      "Verifique su correo para abrir casos. Le enviamos un enlace al crear la cuenta; si venció, pida uno nuevo",
    );
    expect(
      within(dialog).getByRole("button", { name: "Enviarme un enlace nuevo" }),
    ).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it("un asistente que llega por la URL ve que no puede abrir casos", async () => {
    serve("assistant");
    await renderRoute("/app/casos/nuevo");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No tiene permiso para esta acción.",
    );
    expect(
      screen.queryByRole("button", { name: "Abrir caso" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Título del caso")).not.toBeInTheDocument();
  });

  it("sin violaciones de axe", async () => {
    serve("owner");
    const user = userEvent.setup();
    const { container } = await renderRoute("/app/casos/nuevo");

    await user.type(
      await screen.findByLabelText(/Número de radicación/),
      "1100131",
    );
    await user.tab();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});

describe("Inicio del espacio de trabajo", () => {
  it.each(["owner", "admin", "lawyer"] as const)(
    "un %s ve la acción «Abrir caso»",
    async (role) => {
      serve(role);
      const user = userEvent.setup();
      const { router } = await renderRoute("/app");

      await user.click(await screen.findByRole("link", { name: "Abrir caso" }));
      await waitFor(() =>
        expect(router.state.location.pathname).toBe("/app/casos/nuevo"),
      );
    },
  );

  it("un asistente no ve la acción «Abrir caso»", async () => {
    serve("assistant");
    await renderRoute("/app");

    await screen.findByRole("heading", { level: 1, name: "Laura Gómez" });
    expect(
      screen.queryByRole("link", { name: "Abrir caso" }),
    ).not.toBeInTheDocument();
  });
});
