import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();
const ADMIN_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const OTHER_ID = "01890a5d-ac96-774b-bcce-b302099a8060";

function serve(platformAdmin: boolean) {
  let status = "active";
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me")
      return jsonResponse({
        id: ADMIN_ID,
        full_name: "Ana Restrepo",
        email: "ana@example.com",
        email_verified: true,
        platform_admin: platformAdmin,
        permissions: platformAdmin ? ["platform.manage"] : [],
        organization: null,
        legal: {
          accepted_version: LEGAL_VERSION,
          current_version: LEGAL_VERSION,
          acceptance_required: false,
        },
      });
    if (path === "/api/v1/platform/users" && request.method === "GET")
      return jsonResponse({
        items: [
          {
            id: OTHER_ID,
            full_name: "Carlos Gómez",
            email: "carlos@example.com",
            status,
            email_verified: true,
            platform_admin: false,
            created_at: "2026-11-01T15:00:00Z",
          },
        ],
        next_cursor: null,
      });
    if (
      path === `/api/v1/platform/users/${OTHER_ID}/status` &&
      request.method === "PATCH"
    ) {
      status = ((await request.json()) as { status: string }).status;
      return jsonResponse({ id: OTHER_ID, status });
    }
    throw new Error(`Ruta inesperada: ${request.method} ${path}`);
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("impide cargar cuentas a quien no administra la plataforma", async () => {
  serve(false);
  await renderRoute("/app/plataforma");
  expect(
    await screen.findByText("Esta cuenta no administra la plataforma."),
  ).toBeInTheDocument();
  expect(
    fetchMock.mock.calls.some(([input]) =>
      (input as Request).url.includes("/api/v1/platform/users"),
    ),
  ).toBe(false);
});

it("confirma el bloqueo y actualiza el estado de la cuenta", async () => {
  serve(true);
  const user = userEvent.setup();
  await renderRoute("/app/plataforma");
  expect(await screen.findByText("carlos@example.com")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Bloquear" }));
  const dialog = screen.getByRole("dialog", { name: "Bloquear cuenta" });
  expect(dialog).toHaveTextContent("carlos@example.com");
  await user.click(screen.getByRole("button", { name: "Bloquear cuenta" }));
  await waitFor(() =>
    expect(screen.getByText("Bloqueada")).toBeInTheDocument(),
  );
  expect(
    fetchMock.mock.calls.some(
      ([input]) =>
        (input as Request).method === "PATCH" &&
        (input as Request).url.includes(`/platform/users/${OTHER_ID}/status`),
    ),
  ).toBe(true);
});
