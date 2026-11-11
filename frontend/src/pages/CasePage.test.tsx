import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

const CASE_ID = "01890a5d-ac96-774b-bcce-b302099a8090";
const RADICADO = "11001310500320260014300";
const EVENT_HASH = `9f2c71d0b8e4${"0".repeat(48)}a41e`;
const MSG_011 = "No encontramos lo que busca o no tiene acceso a ello.";

const ME = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Laura Gómez",
  email: "laura@example.com",
  email_verified: true,
  organization: {
    id: "01890a5d-ac96-774b-bcce-b302099a8058",
    name: "Ruiz & Asociados",
    role: "lawyer",
  },
  legal: {
    accepted_version: LEGAL_VERSION,
    current_version: LEGAL_VERSION,
    acceptance_required: false,
  },
};

const DETAIL = {
  id: CASE_ID,
  title: "Despido sin justa causa · Torres",
  filing_number: RADICADO,
  court: "Juzgado 3 Laboral del Circuito de Bogotá",
  practice_area: "labor",
  internal_reference: "RA-2026-031",
  status: "open",
  created_at: "2026-11-10T15:32:07Z",
  created_by_name: "Laura Gómez",
  member_count: 1,
  members: [
    {
      user_id: ME.id,
      full_name: "Laura Gómez",
      email: "laura@example.com",
      role: "lawyer",
      added_at: "2026-11-10T15:32:07Z",
    },
  ],
  recent_events: [
    {
      seq: 1,
      action: "case_created",
      actor_name: "Laura Gómez",
      occurred_at: "2026-11-10T15:32:07Z",
      event_hash: EVENT_HASH,
    },
  ],
};

function serve(caseResponse: () => Response) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me") return jsonResponse(ME);
    if (request.method === "GET" && path === `/api/v1/cases/${CASE_ID}`) {
      return caseResponse();
    }
    throw new Error(`Ruta inesperada: ${request.method} ${path}`);
  });
}

async function openCase(state?: { justOpened: boolean }) {
  const rendered = await renderRoute({
    pathname: `/app/casos/${CASE_ID}`,
    state,
  });
  await screen.findByRole("heading", {
    level: 1,
    name: "Despido sin justa causa · Torres",
  });
  return rendered;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Página del caso (HU-015)", () => {
  it("muestra el radicado por bloques, el título y los chips de especialidad, despacho y apertura", async () => {
    serve(() => jsonResponse(DETAIL));
    await openCase();

    const filing = screen.getByText("11001 31 05 003 2026 00143 00");
    expect(filing).toHaveAttribute("translate", "no");
    const chips = screen.getByRole("list", { name: "Datos del caso" });
    expect(within(chips).getByText("Laboral")).toBeInTheDocument();
    expect(
      within(chips).getByText("Juzgado 3 Laboral del Circuito de Bogotá"),
    ).toBeInTheDocument();
    expect(
      within(chips).getByText(/^Abierto el .*10:32 por Laura Gómez$/),
    ).toBeInTheDocument();
  });

  it("muestra el evento 1 con su hash abreviado y la hora en UTC−5", async () => {
    serve(() => jsonResponse(DETAIL));
    await openCase();

    const tab = screen.getByRole("tab", { name: /Cadena de custodia/ });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).toHaveTextContent("1");
    const panel = screen.getByRole("tabpanel", { name: /Cadena de custodia/ });
    const event = within(panel).getByRole("listitem", { name: /Evento 1/ });
    expect(within(event).getByText("Caso creado")).toBeInTheDocument();
    const time = within(event).getByText(/10:32:07 \(UTC−5\)$/);
    expect(time).toHaveAttribute("datetime", "2026-11-10T15:32:07Z");
    expect(time.parentElement).toHaveTextContent(/^Laura Gómez · /);
    const hash = within(event).getByText("9f2c 71d0 b8e4 … a41e");
    expect(hash.closest("[translate='no']")).not.toBeNull();
    // El lector de pantalla recibe la huella completa.
    expect(within(event).getByText(EVENT_HASH)).toBeInTheDocument();
  });

  it("muestra el equipo con quien abrió el caso", async () => {
    serve(() => jsonResponse(DETAIL));
    const user = userEvent.setup();
    await openCase();

    const teamTab = screen.getByRole("tab", { name: /Equipo/ });
    expect(teamTab).toHaveTextContent("1");
    await user.click(screen.getByRole("tab", { name: /Cadena de custodia/ }));
    await user.keyboard("{ArrowRight}");
    expect(teamTab).toHaveAttribute("aria-selected", "true");
    expect(teamTab).toHaveFocus();

    const panel = screen.getByRole("tabpanel", { name: /Equipo/ });
    const member = within(panel).getByRole("listitem");
    expect(within(member).getByText("Laura Gómez")).toBeInTheDocument();
    expect(within(member).getByText("laura@example.com")).toBeInTheDocument();
    expect(
      within(member).getByText("Abogado · abrió el caso"),
    ).toBeInTheDocument();
  });

  it("no muestra «Editar datos», «Subir evidencia» ni «Verificar ahora»", async () => {
    serve(() => jsonResponse(DETAIL));
    await openCase();

    for (const name of [
      /Editar datos/,
      /Subir evidencia/,
      /Verificar ahora/,
      /Paquetes/,
      /Evidencias/,
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
      expect(screen.queryByRole("link", { name })).toBeNull();
      expect(screen.queryByRole("tab", { name })).toBeNull();
    }
    expect(screen.queryByText(/Cadena íntegra/)).toBeNull();
    expect(screen.getByText("Sin verificar")).toBeInTheDocument();
  });

  it("al llegar recién abierto anuncia «Caso abierto. Su cadena de custodia comenzó.»", async () => {
    serve(() => jsonResponse(DETAIL));
    await openCase({ justOpened: true });

    const notice = screen
      .getByText("Caso abierto. Su cadena de custodia comenzó.")
      .closest("[role='status']");
    expect(notice).not.toBeNull();
  });

  it("el aviso de recién abierto se muestra una vez y no vuelve al recargar", async () => {
    serve(() => jsonResponse(DETAIL));
    const { router } = await openCase({ justOpened: true });

    // El estado se borra del historial: recargar o volver atrás no repite el aviso.
    await waitFor(() => {
      expect(router.state.location.state).toBeNull();
    });
    expect(router.state.location.pathname).toBe(`/app/casos/${CASE_ID}`);
    expect(
      screen.getAllByText("Caso abierto. Su cadena de custodia comenzó."),
    ).toHaveLength(1);
  });

  it("sin el estado de recién abierto no muestra el aviso", async () => {
    serve(() => jsonResponse(DETAIL));
    await openCase();

    expect(
      screen.queryByText("Caso abierto. Su cadena de custodia comenzó."),
    ).toBeNull();
  });

  it("un caso sin radicado ni especialidad no inventa esos datos", async () => {
    serve(() =>
      jsonResponse({
        ...DETAIL,
        filing_number: null,
        practice_area: null,
        court: null,
      }),
    );
    await openCase();

    const reference = screen.getByText(/^Sin radicado · ref\. interna/);
    expect(reference).toHaveTextContent(
      "Sin radicado · ref. interna RA-2026-031",
    );
    expect(within(reference).getByText("RA-2026-031")).toHaveAttribute(
      "translate",
      "no",
    );
    const chips = screen.getByRole("list", { name: "Datos del caso" });
    expect(within(chips).getAllByRole("listitem")).toHaveLength(1);
  });

  it("el estado del caso no usa el verde reservado a la verificación", async () => {
    serve(() => jsonResponse(DETAIL));
    const { container } = await openCase();

    const badge = screen.getByText("Abierto").closest("[data-tone]");
    expect(badge).toHaveAttribute("data-tone", "muted");
    // Ningún elemento de la página lleva el tono verde por defecto.
    expect(container.querySelector("[data-tone='ok']")).toBeNull();
  });

  it("un caso que no existe muestra MSG-011", async () => {
    serve(() =>
      jsonResponse(
        {
          type: "about:blank",
          title: "Not Found",
          status: 404,
          detail: MSG_011,
        },
        404,
      ),
    );
    await renderRoute(`/app/casos/${CASE_ID}`);

    expect(await screen.findByText(MSG_011)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Caso no disponible" }),
    ).toBeInTheDocument();
  });

  it("un id mal formado también muestra MSG-011 y no un error del sistema", async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = new URL((input as Request).url).pathname;
      if (path === "/api/v1/me") return jsonResponse(ME);
      return jsonResponse(
        { type: "about:blank", title: "Unprocessable", status: 422 },
        422,
      );
    });
    await renderRoute("/app/casos/no-es-un-id");

    expect(await screen.findByText(MSG_011)).toBeInTheDocument();
  });

  it("sin violaciones de axe", async () => {
    serve(() => jsonResponse(DETAIL));
    const user = userEvent.setup();
    const { container } = await openCase({ justOpened: true });

    expect(await seriousAxeViolations(container)).toEqual([]);
    await user.click(screen.getByRole("tab", { name: /Equipo/ }));
    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});
