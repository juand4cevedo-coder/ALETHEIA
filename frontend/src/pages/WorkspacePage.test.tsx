import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

type Role = "owner" | "admin" | "lawyer" | "assistant";

function me(role: Role, overrides: Record<string, unknown> = {}) {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8057",
    full_name: "Laura Gómez",
    email: "laura@example.com",
    email_verified: true,
    platform_admin: false,
    permissions:
      role === "owner" || role === "admin"
        ? ["team.manage", "billing.manage", "organization.view"]
        : [],
    organization: {
      id: "01890a5d-ac96-774b-bcce-b302099a8058",
      name: "Ruiz & Asociados",
      role,
    },
    subscription: {
      plan_name: "Esencial",
      status: "active",
      access_source: "paid",
      ends_at: null,
    },
    legal: {
      accepted_version: LEGAL_VERSION,
      current_version: LEGAL_VERSION,
      acceptance_required: false,
    },
    ...overrides,
  };
}

const TOTALS = {
  open: 3,
  closed: 1,
  evidences: 16,
  pending_stamps: 2,
  custody_events: 42,
};

function caseItem(overrides: Record<string, unknown> = {}) {
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
    evidence_by_type: { document: 1 },
    member_initials: ["LG"],
    last_event: {
      action: "evidence_uploaded",
      actor_name: "Laura Gómez",
      occurred_at: "2026-11-10T15:00:00Z",
    },
    recent_actions: ["evidence_uploaded"],
    last_activity_at: "2026-11-10T15:00:00Z",
    ...overrides,
  };
}

function serve(role: Role, meOverrides: Record<string, unknown> = {}) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    if (url.pathname === "/api/v1/me") {
      return jsonResponse(me(role, meOverrides));
    }
    if (url.pathname === "/api/v1/cases") {
      const limit = url.searchParams.get("limit");
      if (limit === "1") {
        return jsonResponse({ items: [], next_cursor: null, totals: TOTALS });
      }
      return jsonResponse({
        items: [caseItem()],
        next_cursor: null,
        totals: TOTALS,
      });
    }
    throw new Error(`Ruta inesperada: ${request.method} ${url.pathname}`);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Tablero del espacio de trabajo (HU-031)", () => {
  it("muestra el resumen de casos y la actividad reciente, sin violar accesibilidad", async () => {
    serve("owner");
    const { container } = await renderRoute("/app");

    await screen.findByRole("heading", { level: 1, name: "Laura Gómez" });
    expect(screen.getByText("Ruiz & Asociados, Propietario")).toBeInTheDocument();

    const overview = screen.getByRole("region", {
      name: "Resumen de sus casos",
    });
    expect(await within(overview).findByText("3")).toBeInTheDocument();
    expect(within(overview).getByText("2")).toBeInTheDocument();
    expect(
      screen.getByText("Evidencias esperando su sello."),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Despido sin justa causa, Torres"),
    ).toBeInTheDocument();
    expect(screen.getByText("Evidencia subida")).toBeInTheDocument();
    expect(screen.getByText(/por Laura Gómez/)).toBeInTheDocument();

    const quickLinks = screen
      .getByText("Accesos rápidos")
      .closest("section")!;
    expect(
      within(quickLinks).getByRole("link", { name: /Equipo/ }),
    ).toHaveAttribute("href", "/app/miembros");
    expect(
      within(quickLinks).getByRole("link", { name: /Auditoría de seguridad/ }),
    ).toHaveAttribute("href", "/app/auditoria");

    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("un asistente ve sus casos asignados, no el acceso para abrir uno nuevo", async () => {
    serve("assistant");
    await renderRoute("/app");

    await screen.findByRole("heading", { level: 1, name: "Laura Gómez" });
    expect(
      screen.getByRole("link", { name: "Ver mis casos asignados" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Abrir un caso" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Equipo/ }),
    ).not.toBeInTheDocument();
  });

  it("avisa cuando la prueba está por vencer y enlaza a Mi cuenta", async () => {
    serve("owner", {
      subscription: {
        plan_name: "Esencial",
        status: "trial",
        access_source: "trial",
        ends_at: "2026-12-01T00:00:00Z",
      },
    });
    await renderRoute("/app");

    const notice = await screen.findByText(/Su período de prueba está activo/);
    expect(
      within(notice.closest("div")!).getByRole("link", {
        name: "Revise el plan en Mi cuenta",
      }),
    ).toHaveAttribute("href", "/app/cuenta");
  });

  it("cuando no hay casos todavía, invita a abrir el primero", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL((input as Request).url);
      if (url.pathname === "/api/v1/me") return jsonResponse(me("owner"));
      if (url.pathname === "/api/v1/cases") {
        return jsonResponse({
          items: [],
          next_cursor: null,
          totals: { ...TOTALS, open: 0, closed: 0, pending_stamps: 0 },
        });
      }
      throw new Error("ruta inesperada");
    });
    await renderRoute("/app");

    const empty = (await screen.findByText("Todavía no hay casos")).closest(
      "section",
    )!;
    expect(
      within(empty).getByRole("link", { name: /Abrir un caso/ }),
    ).toHaveAttribute("href", "/app/casos/nuevo");
  });

  it("no se cae si el resumen de casos llega con otra forma", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL((input as Request).url);
      if (url.pathname === "/api/v1/me") return jsonResponse(me("owner"));
      throw new Error("ruta inesperada");
    });
    await renderRoute("/app");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Laura Gómez" }),
    ).toBeInTheDocument();
  });
});
