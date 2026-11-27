import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

const ME = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Ana Restrepo",
  email: "ana@example.com",
  email_verified: true,
  organization: {
    id: "01890a5d-ac96-774b-bcce-b302099a8058",
    name: "Restrepo Abogados",
    role: "lawyer",
    kind: "individual",
  },
  legal: {
    accepted_version: LEGAL_VERSION,
    current_version: LEGAL_VERSION,
    acceptance_required: false,
  },
};

const SUMMARY = {
  cases: 2,
  evidences: 5,
  stored_bytes: 2_500_000,
  legal_hold: 1,
  review_due: 1,
  review_upcoming: 1,
  by_year: [
    { year: 2026, cases: 1 },
    { year: 2025, cases: 1 },
  ],
  by_retention_basis: [],
  by_practice_area: [],
};

const CASE = (
  id: string,
  title: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  title,
  filing_number: null,
  court: "Juzgado 2 Laboral de Medellín",
  practice_area: "labor",
  internal_reference: null,
  status: "closed",
  created_at: "2025-01-10T15:00:00Z",
  closed_at: "2025-03-10T15:00:00Z",
  retention_until: "2020-01-01T00:00:00Z",
  retention_basis: "organization_policy",
  legal_hold: false,
  created_by_name: "Ana Restrepo",
  member_count: 2,
  evidence_count: 3,
  evidence_by_type: { document: 3 },
  member_initials: ["AR"],
  last_event: null,
  recent_actions: [],
  last_activity_at: "2025-03-10T15:00:00Z",
  ...extra,
});

function requests(path: string): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL((input as Request).url))
    .filter((url) => url.pathname === path);
}

function serve(items: unknown[]) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    if (url.pathname === "/api/v1/me") return jsonResponse(ME);
    if (url.pathname === "/api/v1/archive/summary")
      return jsonResponse(SUMMARY);
    if (url.pathname === "/api/v1/cases")
      return jsonResponse({
        items,
        next_cursor: null,
        totals: {
          open: 0,
          closed: items.length,
          evidences: 0,
          pending_stamps: 0,
          custody_events: 0,
        },
      });
    throw new Error(`Ruta inesperada: ${url.pathname}`);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Banco de datos", () => {
  it("muestra las cifras y los casos archivados con su plazo de conservación", async () => {
    serve([
      CASE("01890a5d-ac96-774b-bcce-b302099a8101", "Despido de María Pérez"),
      CASE("01890a5d-ac96-774b-bcce-b302099a8102", "Sucesión Gómez", {
        legal_hold: true,
        retention_until: "2090-01-01T00:00:00Z",
      }),
    ]);
    const { container } = await renderRoute("/app/banco-de-datos");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Banco de datos" }),
    ).toBeInTheDocument();
    const figures = await screen.findByRole("region", {
      name: "Cifras del archivo",
    });
    expect(await within(figures).findByText("5")).toBeInTheDocument();
    expect(within(figures).getByText("Casos archivados")).toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "Casos archivados" });
    expect(
      within(list).getByRole("link", { name: "Despido de María Pérez" }),
    ).toHaveAttribute(
      "href",
      "/app/casos/01890a5d-ac96-774b-bcce-b302099a8101",
    );
    expect(
      within(list).getByText("Plazo vencido, para revisión"),
    ).toBeVisible();
    expect(within(list).getByText("Bloqueo por litigio")).toBeVisible();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("busca en el archivo con una pausa y manda la búsqueda al servidor", async () => {
    serve([CASE("01890a5d-ac96-774b-bcce-b302099a8101", "Despido")]);
    const user = userEvent.setup();
    await renderRoute("/app/banco-de-datos");

    await user.type(
      await screen.findByRole("searchbox", { name: "Buscar en el archivo" }),
      "contrato",
    );

    await waitFor(() =>
      expect(
        requests("/api/v1/cases").some(
          (url) =>
            url.searchParams.get("search") === "contrato" &&
            url.searchParams.get("status") === "closed",
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(
        requests("/api/v1/archive/summary").some(
          (url) => url.searchParams.get("search") === "contrato",
        ),
      ).toBe(true),
    );
  });

  it("filtra por año y deja el mismo filtro en el enlace del índice", async () => {
    serve([CASE("01890a5d-ac96-774b-bcce-b302099a8101", "Despido")]);
    const user = userEvent.setup();
    await renderRoute("/app/banco-de-datos");

    const select = await screen.findByLabelText("Año de cierre");
    await screen.findByRole("option", { name: "2025 (1)" });
    await user.selectOptions(select, "2025");

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Descargar el índice (CSV)" }),
      ).toHaveAttribute(
        "href",
        expect.stringContaining("closed_from=2025-01-01"),
      ),
    );
    expect(
      screen.getByRole("link", { name: "Descargar el índice (CSV)" }),
    ).toHaveAttribute("href", expect.stringContaining("closed_to=2025-12-31"));
  });

  it("dice que todavía no hay casos archivados y no ofrece filtros que quitar", async () => {
    serve([]);
    await renderRoute("/app/banco-de-datos");

    expect(
      await screen.findByText("Todavía no tiene casos archivados"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Quitar los filtros" }),
    ).not.toBeInTheDocument();
  });
});
