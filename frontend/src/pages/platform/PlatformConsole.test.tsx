import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../../config/legal.ts";
import { seriousAxeViolations } from "../../test/axe.ts";
import { jsonResponse, renderRoute } from "../../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const ME = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Ana Restrepo",
  email: "ana@example.com",
  email_verified: true,
  platform_admin: true,
  permissions: ["platform.manage"],
  organization: null,
  legal: {
    accepted_version: LEGAL_VERSION,
    current_version: LEGAL_VERSION,
    acceptance_required: false,
  },
};

const OVERVIEW = {
  accounts_total: 42,
  accounts_new_7_days: 3,
  accounts_new_30_days: 9,
  accounts_blocked: 1,
  organizations_total: 17,
  organizations_read_only: 2,
  subscriptions: { trial: 5, active: 10, past_due: 1 },
  collected_30_days_cop: 598_000,
  receipts_30_days: 2,
  tickets_open: 4,
  tickets_overdue: 2,
  tickets_due_soon: 1,
  jobs_failed: 1,
  jobs_waiting: 3,
  payment_events_pending: 0,
  storage_used_bytes: 5 * 1024 ** 3,
  expiring: [
    {
      organization_id: "01890a5d-ac96-774b-bcce-b302099a8001",
      organization_name: "Ruiz Abogados",
      plan_name: "Esencial",
      access_source: "payment",
      ends_at: "2026-11-28T15:00:00Z",
    },
  ],
  recent_accounts: [],
  signups: Array.from({ length: 30 }, (_, index) => ({
    day: `2026-11-${String(index + 1).padStart(2, "0")}`,
    accounts: index % 7 === 0 ? 2 : 0,
  })),
};

type Handler = (request: Request) => Response | Promise<Response>;

function serve(routes: Record<string, Handler>, platformAdmin = true) {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me")
      return jsonResponse({ ...ME, platform_admin: platformAdmin });
    const handler = routes[`${request.method} ${path}`];
    if (handler) return handler(request);
    throw new Error(`Ruta inesperada: ${request.method} ${path}`);
  });
}

describe("Resumen de la plataforma", () => {
  it("pone primero lo que exige una acción y enlaza a donde se resuelve", async () => {
    serve({ "GET /api/v1/platform/overview": () => jsonResponse(OVERVIEW) });
    const { container } = await renderRoute("/app/plataforma");

    const attention = await screen.findByRole("heading", {
      name: "Requiere su atención",
    });
    const section = attention.closest("section")!;
    expect(
      within(section).getByRole("link", {
        name: /2 solicitudes con el plazo vencido/,
      }),
    ).toHaveAttribute("href", "/app/plataforma/soporte");
    expect(
      within(section).getByRole("link", { name: /Una tarea falló/ }),
    ).toHaveAttribute("href", "/app/plataforma/operacion");
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Ruiz Abogados")).toBeInTheDocument();
    expect(
      screen.getByText(/cuentas nuevas en los últimos 30 días/),
    ).toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("sin pendientes dice que todo está al día", async () => {
    serve({
      "GET /api/v1/platform/overview": () =>
        jsonResponse({
          ...OVERVIEW,
          tickets_overdue: 0,
          tickets_due_soon: 0,
          jobs_failed: 0,
        }),
    });
    await renderRoute("/app/plataforma");
    expect(await screen.findByText(/Todo al día/)).toBeInTheDocument();
  });

  it("una cuenta sin el cargo no consulta nada de la plataforma", async () => {
    serve({}, false);
    await renderRoute("/app/plataforma/despachos");
    expect(
      await screen.findByText("Esta cuenta no administra la plataforma."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Directorio de despachos", () => {
  it("lista los despachos y envía la búsqueda al servidor", async () => {
    const searches: (string | null)[] = [];
    serve({
      "GET /api/v1/platform/organizations": (request) => {
        searches.push(new URL(request.url).searchParams.get("search"));
        return jsonResponse({
          items: [
            {
              id: "01890a5d-ac96-774b-bcce-b302099a8002",
              name: "Gómez y Asociados",
              status: "active",
              owner_name: "Lina Gómez",
              owner_email: "lina@example.com",
              members: 4,
              plan_name: "Equipo",
              subscription_status: "active",
              access_source: "payment",
              billing_cycle: "monthly",
              ends_at: "2026-12-20T15:00:00Z",
              storage_used_bytes: 1024 ** 3,
              storage_limit_bytes: 50 * 1024 ** 3,
              created_at: "2026-10-01T15:00:00Z",
            },
          ],
          total: 1,
          next_cursor: null,
        });
      },
    });
    const user = userEvent.setup();
    await renderRoute("/app/plataforma/despachos");

    expect(await screen.findByText("Gómez y Asociados")).toBeInTheDocument();
    expect(screen.getByText("1 GB de 50 GB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeEnabled();
    await user.type(
      screen.getByRole("searchbox", { name: "Despacho o responsable" }),
      "gómez",
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(searches).toContain("gómez"));
  });
});

describe("Operación", () => {
  it("reintenta una tarea fallida", async () => {
    let retried = false;
    serve({
      "GET /api/v1/platform/operations": () =>
        jsonResponse({
          kinds: [
            {
              kind: "email_send",
              queued: 0,
              running: 0,
              failed: 1,
              done_24_hours: 12,
              oldest_waiting_at: null,
            },
          ],
          failed: [
            {
              id: "01890a5d-ac96-774b-bcce-b302099a8003",
              kind: "email_send",
              attempts: 5,
              failed_at: "2026-11-24T15:00:00Z",
              error: "TimeoutError",
            },
          ],
          payment_events_pending: 0,
          oldest_payment_event_at: null,
        }),
      "POST /api/v1/platform/jobs/01890a5d-ac96-774b-bcce-b302099a8003/retry":
        () => {
          retried = true;
          return new Response(null, { status: 204 });
        },
    });
    const user = userEvent.setup();
    await renderRoute("/app/plataforma/operacion");

    expect(await screen.findByText(/TimeoutError/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(retried).toBe(true));
  });
});

describe("Solicitudes y PQR", () => {
  const BASE = {
    subject: "Duda",
    message: "Un mensaje de prueba.",
    created_at: "2026-11-20T15:00:00Z",
    updated_at: "2026-11-21T15:00:00Z",
    user_email: "laura@example.com",
  };

  it("solo ofrece eliminar las resueltas que ya no hay que conservar", async () => {
    let deleted = "";
    serve({
      "GET /api/v1/platform/support/tickets": () =>
        jsonResponse({
          items: [
            {
              ...BASE,
              id: "01890a5d-ac96-774b-bcce-b302099a8010",
              filing_number: "PQR-2026-00010",
              category: "support",
              status: "closed",
              due_on: "2026-12-10",
              closed_at: "2026-11-21T15:00:00Z",
              deletable_on: "2026-11-21",
            },
            {
              ...BASE,
              id: "01890a5d-ac96-774b-bcce-b302099a8011",
              filing_number: "PQR-2026-00011",
              category: "data_claim",
              status: "closed",
              due_on: "2026-12-10",
              closed_at: "2026-11-21T15:00:00Z",
              deletable_on: "2029-11-22",
            },
          ],
          next_cursor: null,
        }),
      "DELETE /api/v1/platform/support/tickets/01890a5d-ac96-774b-bcce-b302099a8010":
        (request) => {
          deleted = new URL(request.url).pathname;
          return new Response(null, { status: 204 });
        },
    });
    const user = userEvent.setup();
    await renderRoute("/app/plataforma/soporte");
    await user.click(await screen.findByRole("radio", { name: "Resueltas" }));

    const removable = (await screen.findByText("PQR-2026-00010")).closest(
      "article",
    )!;
    const retained = screen.getByText("PQR-2026-00011").closest("article")!;
    expect(
      within(retained).queryByRole("button", { name: "Eliminar" }),
    ).not.toBeInTheDocument();
    expect(within(retained).getByText(/Se conserva hasta el/)).toBeVisible();
    await user.click(
      within(removable).getByRole("button", { name: "Eliminar" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Eliminar la solicitud" }),
    );
    await waitFor(() => expect(deleted).toMatch(/a8010$/));
  });
});
