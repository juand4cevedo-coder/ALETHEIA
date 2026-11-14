import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("permite enviar una solicitud y verla en la cuenta", async () => {
  let ticket: Record<string, unknown> | null = null;
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me")
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
    if (path === "/api/v1/support/tickets" && request.method === "GET")
      return jsonResponse({ items: ticket ? [ticket] : [], next_cursor: null });
    if (path === "/api/v1/support/tickets" && request.method === "POST") {
      const body = (await request.json()) as {
        subject: string;
        message: string;
      };
      ticket = {
        id: "01890a5d-ac96-774b-bcce-b302099a8058",
        ...body,
        status: "open",
        created_at: "2026-11-13T15:00:00Z",
        updated_at: "2026-11-13T15:00:00Z",
        closed_at: null,
      };
      return jsonResponse(ticket, 201);
    }
    throw new Error(`Ruta inesperada: ${request.method} ${path}`);
  });
  const user = userEvent.setup();
  await renderRoute("/app/soporte");
  await user.type(
    await screen.findByRole("textbox", { name: "Asunto" }),
    "Consulta de ingreso",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Mensaje" }),
    "No puedo ingresar a mi cuenta.",
  );
  await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));
  expect(await screen.findByText("Solicitud enviada.")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByText("Consulta de ingreso")).toBeInTheDocument(),
  );
});
