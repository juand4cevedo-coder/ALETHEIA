import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("no consulta facturación ni auditoría sin el cargo de plataforma", async () => {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    if (new URL(request.url).pathname === "/api/v1/me")
      return jsonResponse({
        id: "01890a5d-ac96-774b-bcce-b302099a8057",
        full_name: "Ana Restrepo",
        email: "ana@example.com",
        email_verified: true,
        platform_admin: false,
        permissions: [],
        organization: null,
        legal: {
          accepted_version: LEGAL_VERSION,
          current_version: LEGAL_VERSION,
          acceptance_required: false,
        },
      });
    throw new Error(`Ruta inesperada: ${request.method} ${request.url}`);
  });
  await renderRoute("/app/plataforma/facturacion");
  expect(
    await screen.findByText("Esta cuenta no administra la plataforma."),
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("envía la búsqueda, la acción y el periodo al backend de auditoría", async () => {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me")
      return jsonResponse({
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
      });
    if (path === "/api/v1/platform/audit")
      return jsonResponse({ items: [], next_cursor: null, total: 0 });
    throw new Error(`Ruta inesperada: ${request.method} ${request.url}`);
  });
  const user = userEvent.setup();
  await renderRoute("/app/plataforma/auditoria");
  await screen.findByText("0 eventos encontrados");

  await user.type(
    screen.getByLabelText("Persona, organización u objeto"),
    "Gómez Legal",
  );
  await user.selectOptions(screen.getByLabelText("Acción"), "case_closed");
  fireEvent.change(screen.getByLabelText("Desde"), {
    target: { value: "2026-11-20T08:00" },
  });
  fireEvent.change(screen.getByLabelText("Hasta"), {
    target: { value: "2026-11-21T18:00" },
  });
  await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const request = input as Request;
        const url = new URL(request.url);
        return (
          request.method === "GET" &&
          url.pathname === "/api/v1/platform/audit" &&
          url.searchParams.get("search") === "Gómez Legal" &&
          url.searchParams.get("action") === "case_closed" &&
          url.searchParams.has("created_from") &&
          url.searchParams.has("created_to")
        );
      }),
    ).toBe(true),
  );
});
