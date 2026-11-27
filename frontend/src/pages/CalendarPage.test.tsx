import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // El calendario abre en el mes de hoy: se fija para que la prueba no dependa de la fecha.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-22T17:00:00Z"));
});

function profile() {
  return {
    id: "01890a5d-ac96-774b-bcce-b302099a8057",
    full_name: "Laura Gómez",
    email: "laura@example.com",
    email_verified: true,
    platform_admin: false,
    permissions: [],
    organization: {
      id: "01890a5d-ac96-774b-bcce-b302099a8058",
      name: "Gómez Abogados",
      role: "lawyer",
      kind: "individual",
    },
    legal: {
      accepted_version: LEGAL_VERSION,
      current_version: LEGAL_VERSION,
      acceptance_required: false,
    },
  };
}

function task(id: string, title: string, due_at: string, priority = "high") {
  return {
    id,
    case_id: "01890a5d-ac96-774b-bcce-b302099a8070",
    title,
    description: null,
    priority,
    status: "pending",
    due_at,
    assigned_to: "01890a5d-ac96-774b-bcce-b302099a8057",
    assignee_name: "Laura Gómez",
    created_by: "01890a5d-ac96-774b-bcce-b302099a8057",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    completed_at: null,
    case_title: "Sucesión López",
    case_status: "open",
  };
}

function mockApi(items: ReturnType<typeof task>[]) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    if (url.pathname === "/api/v1/me") return jsonResponse(profile());
    if (url.pathname === "/api/v1/tasks/calendar")
      return jsonResponse({ items, truncated: false });
    if (url.pathname === "/api/v1/cases")
      return jsonResponse({
        items: [],
        next_cursor: null,
        totals: { open: 0, closed: 0, pending_stamps: 0, custody_events: 0 },
      });
    throw new Error(`Ruta inesperada: ${url.pathname}`);
  });
}

it("muestra los plazos del mes y el detalle del día elegido", async () => {
  mockApi([
    task("t1", "Radicar memorial", "2026-11-24T20:00:00Z"),
    task("t2", "Copia del expediente", "2026-11-24T15:00:00Z", "normal"),
    task("t3", "Audiencia inicial", "2026-11-30T14:00:00Z", "urgent"),
  ]);
  const user = userEvent.setup();
  await renderRoute("/app/calendario");

  expect(
    await screen.findByRole("heading", { name: "Calendario de plazos" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Noviembre de 2026")).toBeInTheDocument();

  const day = await screen.findByRole("gridcell", {
    name: /Martes, 24 de noviembre: 2 plazos/,
  });
  await user.click(day);
  const detail = screen.getByRole("region", { name: /24 de noviembre/ });
  expect(within(detail).getByText("Radicar memorial")).toBeInTheDocument();
  expect(within(detail).getByText("Copia del expediente")).toBeInTheDocument();
  expect(within(detail).getAllByText(/Sucesión López/)).toHaveLength(2);
});

it("avisa cuando el mes no tiene plazos y ofrece llegar a los casos", async () => {
  mockApi([]);
  await renderRoute("/app/calendario");
  expect(
    await screen.findByText("Este mes no tiene plazos"),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir a mis casos" })).toHaveAttribute(
    "href",
    "/app/casos",
  );
  expect(
    screen.getByRole("button", { name: /Llevar a mi calendario/ }),
  ).toBeDisabled();
});
